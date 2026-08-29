import type { Database } from '@/database';
import { ParticipantNotFoundError } from '@/domain/errors';
import type { Participant, ParticipantId, ParticipantInput } from '@/types/participant';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';

import { optionalText, toBool, toNullable } from './rows';
import type { ParticipantRepository } from '../types';

interface ParticipantRow {
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

function toParticipant(row: ParticipantRow): Participant {
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

const SELECT = `SELECT id, owner_user_id, linked_user_id, name, phone, email, avatar_uri,
                       is_self, created_at, updated_at
                  FROM participants`;

export class SqliteParticipantRepository implements ParticipantRepository {
  constructor(private readonly db: Database) {}

  async listFriends(ownerUserId: string): Promise<Participant[]> {
    const rows = await this.db.query<ParticipantRow>(
      `${SELECT} WHERE owner_user_id = ? AND deleted_at IS NULL AND is_self = 0
         ORDER BY name COLLATE NOCASE`,
      [ownerUserId]
    );
    return rows.map(toParticipant);
  }

  async listAll(ownerUserId: string): Promise<Participant[]> {
    const rows = await this.db.query<ParticipantRow>(
      `${SELECT} WHERE owner_user_id = ? AND deleted_at IS NULL
         ORDER BY is_self DESC, name COLLATE NOCASE`,
      [ownerUserId]
    );
    return rows.map(toParticipant);
  }

  async getById(id: ParticipantId): Promise<Participant | null> {
    const row = await this.db.queryOne<ParticipantRow>(`${SELECT} WHERE id = ?`, [id]);
    return row ? toParticipant(row) : null;
  }

  async getSelf(ownerUserId: string): Promise<Participant | null> {
    const row = await this.db.queryOne<ParticipantRow>(
      `${SELECT} WHERE owner_user_id = ? AND is_self = 1`,
      [ownerUserId]
    );
    return row ? toParticipant(row) : null;
  }

  /**
   * Every user needs a participant row: they are a person in their own
   * expenses. Created on first login and reused after that.
   */
  async ensureSelf(ownerUserId: string, name: string, email?: string): Promise<Participant> {
    const existing = await this.getSelf(ownerUserId);
    if (existing) return existing;

    const timestamp = nowIso();
    const participant: Participant = {
      id: createId('person'),
      ownerUserId,
      linkedUserId: ownerUserId,
      name: name.trim(),
      email,
      isSelf: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.db.execute(
      `INSERT INTO participants (id, owner_user_id, linked_user_id, name, phone, email,
                                 avatar_uri, is_self, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, NULL, 1, ?, ?)`,
      [
        participant.id,
        ownerUserId,
        ownerUserId,
        participant.name,
        toNullable(email),
        timestamp,
        timestamp,
      ]
    );
    return participant;
  }

  async create(ownerUserId: string, input: ParticipantInput): Promise<Participant> {
    const timestamp = nowIso();
    const id = createId('person');

    await this.db.execute(
      `INSERT INTO participants (id, owner_user_id, linked_user_id, name, phone, email,
                                 avatar_uri, is_self, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        ownerUserId,
        input.name.trim(),
        toNullable(input.phone),
        toNullable(input.email),
        toNullable(input.avatarUri),
        timestamp,
        timestamp,
      ]
    );

    const created = await this.getById(id);
    if (!created) throw new ParticipantNotFoundError('Could not save that person.');
    return created;
  }

  async update(id: ParticipantId, input: ParticipantInput): Promise<Participant> {
    const changes = await this.db.executeWithChanges(
      `UPDATE participants
          SET name = ?, phone = ?, email = ?, avatar_uri = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
      [
        input.name.trim(),
        toNullable(input.phone),
        toNullable(input.email),
        toNullable(input.avatarUri),
        nowIso(),
        id,
      ]
    );
    if (changes === 0) throw new ParticipantNotFoundError('That person no longer exists.');

    const updated = await this.getById(id);
    if (!updated) throw new ParticipantNotFoundError('That person no longer exists.');
    return updated;
  }

  /**
   * Soft delete. Expenses reference participants, and removing a friend must
   * not rewrite history or leave an expense with a missing name.
   */
  async remove(id: ParticipantId): Promise<void> {
    await this.db.execute(
      `UPDATE participants SET deleted_at = ?, updated_at = ? WHERE id = ? AND is_self = 0`,
      [nowIso(), nowIso(), id]
    );
  }

  async search(ownerUserId: string, term: string): Promise<Participant[]> {
    const trimmed = term.trim();
    if (trimmed === '') return this.listFriends(ownerUserId);

    const rows = await this.db.query<ParticipantRow>(
      `${SELECT} WHERE owner_user_id = ? AND deleted_at IS NULL AND is_self = 0
                   AND (name LIKE ? COLLATE NOCASE OR phone LIKE ?)
         ORDER BY name COLLATE NOCASE
         LIMIT 20`,
      [ownerUserId, `%${trimmed}%`, `%${trimmed}%`]
    );
    return rows.map(toParticipant);
  }
}
