import type { Database } from '@/database';
import { GroupNotFoundError } from '@/domain/errors';
import type { Group, GroupInput, GroupWithMembers } from '@/types/group';
import type { Participant, ParticipantId } from '@/types/participant';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';

import { bindPlaceholders, optionalText, toBool, toNullable } from './rows';
import type { GroupRepository } from '../types';

interface GroupRow {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  image_uri: string | null;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  group_id: string;
  id: string;
  owner_user_id: string;
  linked_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_uri: string | null;
  is_self: number;
  created_at: string;
  updated_at: string;
}

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    description: optionalText(row.description),
    imageUri: optionalText(row.image_uri),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMember(row: MemberRow): Participant {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    linkedUserId: optionalText(row.linked_user_id),
    name: row.name,
    phone: optionalText(row.phone),
    email: optionalText(row.email),
    avatarUri: optionalText(row.avatar_uri),
    isSelf: toBool(row.is_self),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteGroupRepository implements GroupRepository {
  constructor(private readonly db: Database) {}

  /** Members are fetched in one query and grouped in memory, not per group. */
  private async membersFor(groupIds: string[]): Promise<Map<string, Participant[]>> {
    const byGroup = new Map<string, Participant[]>();
    if (groupIds.length === 0) return byGroup;

    const rows = await this.db.query<MemberRow>(
      `SELECT gm.group_id, p.id, p.owner_user_id, p.linked_user_id, p.name, p.phone, p.email,
              p.avatar_uri, p.is_self, p.created_at, p.updated_at
         FROM group_members gm
         JOIN participants p ON p.id = gm.participant_id
        WHERE gm.group_id IN (${bindPlaceholders(groupIds.length)})
          AND p.deleted_at IS NULL
        ORDER BY p.is_self DESC, p.name COLLATE NOCASE`,
      groupIds
    );

    for (const row of rows) {
      const list = byGroup.get(row.group_id) ?? [];
      list.push(toMember(row));
      byGroup.set(row.group_id, list);
    }
    return byGroup;
  }

  async list(ownerUserId: string): Promise<GroupWithMembers[]> {
    const rows = await this.db.query<GroupRow>(
      `SELECT id, owner_user_id, name, description, image_uri, created_at, updated_at
         FROM groups
        WHERE owner_user_id = ? AND deleted_at IS NULL
        ORDER BY updated_at DESC`,
      [ownerUserId]
    );

    const members = await this.membersFor(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...toGroup(row),
      members: members.get(row.id) ?? [],
    }));
  }

  async getById(id: string): Promise<GroupWithMembers | null> {
    const row = await this.db.queryOne<GroupRow>(
      `SELECT id, owner_user_id, name, description, image_uri, created_at, updated_at
         FROM groups WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!row) return null;

    const members = await this.membersFor([id]);
    return { ...toGroup(row), members: members.get(id) ?? [] };
  }

  async create(ownerUserId: string, input: GroupInput): Promise<GroupWithMembers> {
    const id = createId('group');
    const timestamp = nowIso();

    await this.db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO groups (id, owner_user_id, name, description, image_uri, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ownerUserId,
          input.name.trim(),
          toNullable(input.description),
          toNullable(input.imageUri),
          timestamp,
          timestamp,
        ]
      );
      await this.replaceMembers(tx, id, input.memberIds, timestamp);
    });

    const created = await this.getById(id);
    if (!created) throw new GroupNotFoundError('Could not create that group.');
    return created;
  }

  async update(id: string, input: GroupInput): Promise<GroupWithMembers> {
    const timestamp = nowIso();

    await this.db.transaction(async (tx) => {
      const changes = await tx.executeWithChanges(
        `UPDATE groups SET name = ?, description = ?, image_uri = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        [
          input.name.trim(),
          toNullable(input.description),
          toNullable(input.imageUri),
          timestamp,
          id,
        ]
      );
      if (changes === 0) throw new GroupNotFoundError('That group no longer exists.');
      await this.replaceMembers(tx, id, input.memberIds, timestamp);
    });

    const updated = await this.getById(id);
    if (!updated) throw new GroupNotFoundError('That group no longer exists.');
    return updated;
  }

  /**
   * Members are replaced wholesale, but only rows that actually changed are
   * touched, so a member's `created_at` survives an unrelated group rename.
   */
  private async replaceMembers(
    tx: Database,
    groupId: string,
    memberIds: ParticipantId[],
    timestamp: string
  ): Promise<void> {
    const wanted = [...new Set(memberIds)];
    const current = await tx.query<{ participant_id: string }>(
      `SELECT participant_id FROM group_members WHERE group_id = ?`,
      [groupId]
    );
    const currentIds = new Set(current.map((row) => row.participant_id));

    for (const participantId of wanted) {
      if (currentIds.has(participantId)) continue;
      await tx.execute(
        `INSERT INTO group_members (id, group_id, participant_id, created_at) VALUES (?, ?, ?, ?)`,
        [createId('member'), groupId, participantId, timestamp]
      );
    }

    const removed = [...currentIds].filter((participantId) => !wanted.includes(participantId));
    if (removed.length > 0) {
      await tx.execute(
        `DELETE FROM group_members
           WHERE group_id = ? AND participant_id IN (${bindPlaceholders(removed.length)})`,
        [groupId, ...removed]
      );
    }
  }

  /** Soft delete; the group's expenses keep their history and their balances. */
  async remove(id: string): Promise<void> {
    const timestamp = nowIso();
    await this.db.execute(`UPDATE groups SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      timestamp,
      timestamp,
      id,
    ]);
  }

  async addMember(groupId: string, participantId: ParticipantId): Promise<void> {
    await this.db.execute(
      `INSERT OR IGNORE INTO group_members (id, group_id, participant_id, created_at)
         VALUES (?, ?, ?, ?)`,
      [createId('member'), groupId, participantId, nowIso()]
    );
  }

  async removeMember(groupId: string, participantId: ParticipantId): Promise<void> {
    await this.db.execute(`DELETE FROM group_members WHERE group_id = ? AND participant_id = ?`, [
      groupId,
      participantId,
    ]);
  }
}
