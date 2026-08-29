import type { Database } from '@/database';
import { SettlementError } from '@/domain/errors';
import type { ExpenseId } from '@/types/expense';
import type { ParticipantId } from '@/types/participant';
import type { Settlement, SettlementInput } from '@/types/settlement';
import { DEFAULT_CURRENCY } from '@/utils/currency';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';

import { optionalText, toNullable } from './rows';
import type { SettlementRepository } from '../types';

interface SettlementRow {
  id: string;
  owner_user_id: string;
  group_id: string | null;
  expense_id: string | null;
  from_participant_id: string;
  to_participant_id: string;
  amount: number;
  currency_code: string;
  settled_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    groupId: optionalText(row.group_id),
    expenseId: optionalText(row.expense_id),
    fromParticipantId: row.from_participant_id,
    toParticipantId: row.to_participant_id,
    amount: row.amount,
    currencyCode: row.currency_code,
    settledAt: row.settled_at,
    notes: optionalText(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, owner_user_id, group_id, expense_id, from_participant_id,
                       to_participant_id, amount, currency_code, settled_at, notes,
                       created_at, updated_at
                  FROM settlements`;

export class SqliteSettlementRepository implements SettlementRepository {
  constructor(private readonly db: Database) {}

  async list(
    ownerUserId: string,
    options: { groupId?: string; limit?: number } = {}
  ): Promise<Settlement[]> {
    const where = ['owner_user_id = ?', 'deleted_at IS NULL'];
    const params: (string | number)[] = [ownerUserId];

    if (options.groupId) {
      where.push('group_id = ?');
      params.push(options.groupId);
    }
    const limit = options.limit ? ' LIMIT ?' : '';
    if (options.limit) params.push(options.limit);

    const rows = await this.db.query<SettlementRow>(
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY settled_at DESC, created_at DESC${limit}`,
      params
    );
    return rows.map(toSettlement);
  }

  async listForExpense(expenseId: ExpenseId): Promise<Settlement[]> {
    const rows = await this.db.query<SettlementRow>(
      `${SELECT} WHERE expense_id = ? AND deleted_at IS NULL ORDER BY settled_at DESC`,
      [expenseId]
    );
    return rows.map(toSettlement);
  }

  async getById(id: string): Promise<Settlement | null> {
    const row = await this.db.queryOne<SettlementRow>(`${SELECT} WHERE id = ?`, [id]);
    return row ? toSettlement(row) : null;
  }

  async create(ownerUserId: string, input: SettlementInput): Promise<Settlement> {
    if (input.fromParticipantId === input.toParticipantId) {
      throw new SettlementError('A settlement needs two different people.');
    }
    if (input.amount <= 0) {
      throw new SettlementError('A settlement must be more than zero.');
    }

    const id = createId('settle');
    const timestamp = nowIso();

    await this.db.execute(
      `INSERT INTO settlements (id, owner_user_id, group_id, expense_id, from_participant_id,
                                to_participant_id, amount, currency_code, settled_at, notes,
                                created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ownerUserId,
        toNullable(input.groupId),
        toNullable(input.expenseId),
        input.fromParticipantId,
        input.toParticipantId,
        Math.round(input.amount),
        input.currencyCode ?? DEFAULT_CURRENCY.code,
        input.settledAt ?? timestamp,
        toNullable(input.notes),
        timestamp,
        timestamp,
      ]
    );

    const created = await this.getById(id);
    if (!created) throw new SettlementError('Could not record that payment.');
    return created;
  }

  /** Soft delete, so undoing a mistaken settle up leaves an audit trail. */
  async remove(id: string): Promise<void> {
    const timestamp = nowIso();
    await this.db.execute(`UPDATE settlements SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      timestamp,
      timestamp,
      id,
    ]);
  }

  /** Backs out a per-share "mark paid" when the user unticks it. */
  async removeForExpenseParticipant(
    expenseId: ExpenseId,
    participantId: ParticipantId
  ): Promise<void> {
    const timestamp = nowIso();
    await this.db.execute(
      `UPDATE settlements SET deleted_at = ?, updated_at = ?
         WHERE expense_id = ? AND from_participant_id = ? AND deleted_at IS NULL`,
      [timestamp, timestamp, expenseId, participantId]
    );
  }
}
