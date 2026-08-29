import type { Database } from '@/database';
import { StorageError } from '@/domain/errors';
import { nextOccurrence } from '@/domain/recurrence';
import type { ExpensePayer, ExpenseSplit } from '@/types/expense';
import type {
  RecurrenceFrequency,
  RecurringExpense,
  RecurringExpenseInput,
} from '@/types/recurring';
import type { SplitType } from '@/types/split';
import { DEFAULT_CURRENCY } from '@/utils/currency';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';

import { optionalText, toBool, toNullable } from './rows';
import type { RecurringExpenseRepository } from '../types';

interface RecurringRow {
  id: string;
  owner_user_id: string;
  group_id: string | null;
  description: string;
  total_amount: number;
  currency_code: string;
  category_id: string;
  split_type: SplitType;
  frequency: RecurrenceFrequency;
  notes: string | null;
  template: string;
  next_due_at: string;
  last_run_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface Template {
  payers: ExpensePayer[];
  splits: Omit<ExpenseSplit, 'splitType'>[];
}

/** Who pays and how it divides is a template, not a financial record, so it is
 *  stored as JSON rather than as payer and split rows of its own. */
function parseTemplate(raw: string): Template {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { payers: [], splits: [] };
    const template = parsed as Partial<Template>;
    return {
      payers: Array.isArray(template.payers) ? template.payers : [],
      splits: Array.isArray(template.splits) ? template.splits : [],
    };
  } catch {
    return { payers: [], splits: [] };
  }
}

function toRecurring(row: RecurringRow): RecurringExpense {
  const template = parseTemplate(row.template);
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    groupId: optionalText(row.group_id),
    description: row.description,
    totalAmount: row.total_amount,
    currencyCode: row.currency_code,
    categoryId: row.category_id,
    splitType: row.split_type,
    frequency: row.frequency,
    notes: optionalText(row.notes),
    payers: template.payers,
    splits: template.splits,
    nextDueAt: row.next_due_at,
    lastRunAt: optionalText(row.last_run_at),
    isActive: toBool(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, owner_user_id, group_id, description, total_amount, currency_code,
                       category_id, split_type, frequency, notes, template, next_due_at,
                       last_run_at, is_active, created_at, updated_at
                  FROM recurring_expenses`;

export class SqliteRecurringExpenseRepository implements RecurringExpenseRepository {
  constructor(private readonly db: Database) {}

  async list(ownerUserId: string): Promise<RecurringExpense[]> {
    const rows = await this.db.query<RecurringRow>(
      `${SELECT} WHERE owner_user_id = ? AND deleted_at IS NULL ORDER BY next_due_at`,
      [ownerUserId]
    );
    return rows.map(toRecurring);
  }

  async getById(id: string): Promise<RecurringExpense | null> {
    const row = await this.db.queryOne<RecurringRow>(`${SELECT} WHERE id = ?`, [id]);
    return row ? toRecurring(row) : null;
  }

  async create(ownerUserId: string, input: RecurringExpenseInput): Promise<RecurringExpense> {
    const id = createId('repeat');
    const timestamp = nowIso();

    await this.db.execute(
      `INSERT INTO recurring_expenses (id, owner_user_id, group_id, description, total_amount,
                                       currency_code, category_id, split_type, frequency, notes,
                                       template, next_due_at, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        ownerUserId,
        toNullable(input.groupId),
        input.description.trim(),
        Math.round(input.totalAmount),
        input.currencyCode ?? DEFAULT_CURRENCY.code,
        input.categoryId,
        input.splitType,
        input.frequency,
        toNullable(input.notes),
        JSON.stringify({ payers: input.payers, splits: input.splits }),
        input.nextDueAt ?? nextOccurrence(timestamp, input.frequency),
        timestamp,
        timestamp,
      ]
    );

    const created = await this.getById(id);
    if (!created) throw new StorageError('Could not save that repeating expense.');
    return created;
  }

  async update(id: string, input: RecurringExpenseInput): Promise<RecurringExpense> {
    const timestamp = nowIso();
    const changes = await this.db.executeWithChanges(
      `UPDATE recurring_expenses
          SET group_id = ?, description = ?, total_amount = ?, currency_code = ?, category_id = ?,
              split_type = ?, frequency = ?, notes = ?, template = ?, next_due_at = ?,
              updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
      [
        toNullable(input.groupId),
        input.description.trim(),
        Math.round(input.totalAmount),
        input.currencyCode ?? DEFAULT_CURRENCY.code,
        input.categoryId,
        input.splitType,
        input.frequency,
        toNullable(input.notes),
        JSON.stringify({ payers: input.payers, splits: input.splits }),
        input.nextDueAt ?? nextOccurrence(timestamp, input.frequency),
        timestamp,
        id,
      ]
    );
    if (changes === 0) throw new StorageError('That repeating expense no longer exists.');

    const updated = await this.getById(id);
    if (!updated) throw new StorageError('That repeating expense no longer exists.');
    return updated;
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.db.execute(
      `UPDATE recurring_expenses SET is_active = ?, updated_at = ? WHERE id = ?`,
      [isActive ? 1 : 0, nowIso(), id]
    );
  }

  async remove(id: string): Promise<void> {
    const timestamp = nowIso();
    await this.db.execute(
      `UPDATE recurring_expenses SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, id]
    );
  }

  async listDue(ownerUserId: string, asOf: string): Promise<RecurringExpense[]> {
    const rows = await this.db.query<RecurringRow>(
      `${SELECT} WHERE owner_user_id = ? AND deleted_at IS NULL AND is_active = 1
                   AND next_due_at <= ?
         ORDER BY next_due_at`,
      [ownerUserId, asOf]
    );
    return rows.map(toRecurring);
  }

  async markRun(id: string, ranAt: string, nextDueAt: string): Promise<void> {
    await this.db.execute(
      `UPDATE recurring_expenses SET last_run_at = ?, next_due_at = ?, updated_at = ? WHERE id = ?`,
      [ranAt, nextDueAt, nowIso(), id]
    );
  }
}
