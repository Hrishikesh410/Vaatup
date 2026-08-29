import type { Database } from '@/database';
import { ExpenseNotFoundError } from '@/domain/errors';
import type {
  Expense,
  ExpenseFilters,
  ExpenseId,
  ExpenseInput,
  ExpenseItem,
  ExpensePayer,
  ExpenseSplit,
} from '@/types/expense';
import type { SplitType } from '@/types/split';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';

import { bindPlaceholders, optionalText, toNullable } from './rows';
import type { ExpenseRepository } from '../types';

interface ExpenseRow {
  id: string;
  owner_user_id: string;
  group_id: string | null;
  description: string;
  total_amount: number;
  base_amount: number;
  tip_amount: number;
  tax_amount: number;
  currency_code: string;
  split_type: SplitType;
  category_id: string;
  notes: string | null;
  receipt_uri: string | null;
  spent_at: string;
  created_at: string;
  updated_at: string;
}

interface PayerRow {
  expense_id: string;
  participant_id: string;
  amount_paid: number;
}

interface SplitRow {
  expense_id: string;
  participant_id: string;
  split_type: SplitType;
  input_value: number;
  amount_owed: number;
}

interface ItemRow {
  id: string;
  expense_id: string;
  name: string;
  amount: number;
  position: number;
}

interface AssignmentRow {
  item_id: string;
  participant_id: string;
}

const SELECT = `SELECT id, owner_user_id, group_id, description, total_amount, base_amount,
                       tip_amount, tax_amount, currency_code, split_type, category_id, notes,
                       receipt_uri, spent_at, created_at, updated_at
                  FROM expenses`;

export class SqliteExpenseRepository implements ExpenseRepository {
  constructor(private readonly db: Database) {}

  /**
   * Loads payers, splits and items for a set of expenses in three queries
   * rather than three per expense, which keeps the history screen to a handful
   * of round trips no matter how long the list is.
   */
  private async hydrate(rows: ExpenseRow[]): Promise<Expense[]> {
    if (rows.length === 0) return [];
    const expenseIds = rows.map((row) => row.id);
    const expenseMarks = bindPlaceholders(expenseIds.length);

    const [payers, splits, items] = await Promise.all([
      this.db.query<PayerRow>(
        `SELECT expense_id, participant_id, amount_paid FROM expense_payers
           WHERE expense_id IN (${expenseMarks})`,
        expenseIds
      ),
      this.db.query<SplitRow>(
        `SELECT expense_id, participant_id, split_type, input_value, amount_owed
           FROM expense_splits WHERE expense_id IN (${expenseMarks})`,
        expenseIds
      ),
      this.db.query<ItemRow>(
        `SELECT id, expense_id, name, amount, position FROM expense_items
           WHERE expense_id IN (${expenseMarks}) ORDER BY position, name`,
        expenseIds
      ),
    ]);

    const assignments =
      items.length === 0
        ? []
        : await this.db.query<AssignmentRow>(
            `SELECT item_id, participant_id FROM expense_item_assignments
               WHERE item_id IN (${bindPlaceholders(items.length)})`,
            items.map((item) => item.id)
          );

    const assignedByItem = new Map<string, string[]>();
    for (const assignment of assignments) {
      const list = assignedByItem.get(assignment.item_id) ?? [];
      list.push(assignment.participant_id);
      assignedByItem.set(assignment.item_id, list);
    }

    const payersByExpense = new Map<string, ExpensePayer[]>();
    for (const row of payers) {
      const list = payersByExpense.get(row.expense_id) ?? [];
      list.push({
        participantId: row.participant_id,
        amountPaid: row.amount_paid,
      });
      payersByExpense.set(row.expense_id, list);
    }

    const splitsByExpense = new Map<string, ExpenseSplit[]>();
    for (const row of splits) {
      const list = splitsByExpense.get(row.expense_id) ?? [];
      list.push({
        personId: row.participant_id,
        amount: row.amount_owed,
        inputValue: row.input_value,
        splitType: row.split_type,
      });
      splitsByExpense.set(row.expense_id, list);
    }

    const itemsByExpense = new Map<string, ExpenseItem[]>();
    for (const row of items) {
      const list = itemsByExpense.get(row.expense_id) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        amount: row.amount,
        position: row.position,
        assignedTo: assignedByItem.get(row.id) ?? [],
      });
      itemsByExpense.set(row.expense_id, list);
    }

    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      groupId: optionalText(row.group_id),
      description: row.description,
      totalAmount: row.total_amount,
      baseAmount: row.base_amount,
      tipAmount: row.tip_amount,
      taxAmount: row.tax_amount,
      currencyCode: row.currency_code,
      splitType: row.split_type,
      categoryId: row.category_id,
      notes: optionalText(row.notes),
      receiptUri: optionalText(row.receipt_uri),
      spentAt: row.spent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payers: payersByExpense.get(row.id) ?? [],
      splits: splitsByExpense.get(row.id) ?? [],
      items: itemsByExpense.get(row.id) ?? [],
    }));
  }

  async list(ownerUserId: string, filters: ExpenseFilters = {}): Promise<Expense[]> {
    const where = ['owner_user_id = ?', 'deleted_at IS NULL'];
    const params: (string | number)[] = [ownerUserId];

    if (filters.groupId) {
      where.push('group_id = ?');
      params.push(filters.groupId);
    }
    if (filters.categoryId) {
      where.push('category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters.from) {
      where.push('spent_at >= ?');
      params.push(filters.from);
    }
    if (filters.to) {
      where.push('spent_at <= ?');
      params.push(filters.to);
    }
    if (filters.search) {
      where.push('(description LIKE ? COLLATE NOCASE OR notes LIKE ? COLLATE NOCASE)');
      params.push(`%${filters.search.trim()}%`, `%${filters.search.trim()}%`);
    }
    if (filters.participantId) {
      // Anyone who paid for it or owes on it counts as involved.
      where.push(`(EXISTS (SELECT 1 FROM expense_payers WHERE expense_id = expenses.id
                             AND participant_id = ?)
                   OR EXISTS (SELECT 1 FROM expense_splits WHERE expense_id = expenses.id
                                AND participant_id = ?))`);
      params.push(filters.participantId, filters.participantId);
    }

    const limit = filters.limit ? ' LIMIT ?' : '';
    if (filters.limit) params.push(filters.limit);

    const rows = await this.db.query<ExpenseRow>(
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY spent_at DESC, created_at DESC${limit}`,
      params
    );
    return this.hydrate(rows);
  }

  async getById(id: ExpenseId): Promise<Expense | null> {
    const row = await this.db.queryOne<ExpenseRow>(`${SELECT} WHERE id = ?`, [id]);
    if (!row) return null;
    const [expense] = await this.hydrate([row]);
    return expense ?? null;
  }

  /**
   * An expense spans four tables, so it is written in one transaction: either
   * the whole thing lands or none of it does. A half-written expense would
   * corrupt every balance that reads it.
   */
  async create(ownerUserId: string, input: ExpenseInput): Promise<Expense> {
    const id = input.id ?? createId('expense');
    const timestamp = nowIso();
    const total = input.baseAmount + input.tipAmount + input.taxAmount;

    await this.db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO expenses (id, owner_user_id, group_id, description, total_amount, base_amount,
                               tip_amount, tax_amount, currency_code, split_type, category_id,
                               notes, receipt_uri, spent_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ownerUserId,
          toNullable(input.groupId),
          input.description.trim(),
          total,
          input.baseAmount,
          input.tipAmount,
          input.taxAmount,
          input.currencyCode,
          input.splitType,
          input.categoryId,
          toNullable(input.notes),
          toNullable(input.receiptUri),
          input.spentAt,
          timestamp,
          timestamp,
        ]
      );
      await this.writeChildren(tx, id, input, timestamp);
    });

    const created = await this.getById(id);
    if (!created) throw new ExpenseNotFoundError('Could not save that expense.');
    return created;
  }

  async update(id: ExpenseId, input: ExpenseInput): Promise<Expense> {
    const timestamp = nowIso();
    const total = input.baseAmount + input.tipAmount + input.taxAmount;

    await this.db.transaction(async (tx) => {
      const changes = await tx.executeWithChanges(
        `UPDATE expenses
            SET group_id = ?, description = ?, total_amount = ?, base_amount = ?, tip_amount = ?,
                tax_amount = ?, currency_code = ?, split_type = ?, category_id = ?, notes = ?,
                receipt_uri = ?, spent_at = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
        [
          toNullable(input.groupId),
          input.description.trim(),
          total,
          input.baseAmount,
          input.tipAmount,
          input.taxAmount,
          input.currencyCode,
          input.splitType,
          input.categoryId,
          toNullable(input.notes),
          toNullable(input.receiptUri),
          input.spentAt,
          timestamp,
          id,
        ]
      );
      if (changes === 0) throw new ExpenseNotFoundError('That expense no longer exists.');

      // Child rows are values of the expense, not entities with their own
      // identity, so replacing them wholesale is simpler than diffing and
      // cannot leave a stale payer or split behind.
      await tx.execute('DELETE FROM expense_payers WHERE expense_id = ?', [id]);
      await tx.execute('DELETE FROM expense_splits WHERE expense_id = ?', [id]);
      await tx.execute('DELETE FROM expense_items WHERE expense_id = ?', [id]);
      await this.writeChildren(tx, id, input, timestamp);
    });

    const updated = await this.getById(id);
    if (!updated) throw new ExpenseNotFoundError('That expense no longer exists.');
    return updated;
  }

  private async writeChildren(
    tx: Database,
    expenseId: ExpenseId,
    input: ExpenseInput,
    timestamp: string
  ): Promise<void> {
    for (const payer of input.payers) {
      await tx.execute(
        `INSERT INTO expense_payers (id, expense_id, participant_id, amount_paid)
           VALUES (?, ?, ?, ?)`,
        [createId('payer'), expenseId, payer.participantId, Math.round(payer.amountPaid)]
      );
    }

    for (const split of input.splits) {
      await tx.execute(
        `INSERT INTO expense_splits (id, expense_id, participant_id, split_type, input_value,
                                     amount_owed)
           VALUES (?, ?, ?, ?, ?, ?)`,
        [
          createId('split'),
          expenseId,
          split.personId,
          input.splitType,
          split.inputValue,
          Math.round(split.amount),
        ]
      );
    }

    for (const [index, item] of (input.items ?? []).entries()) {
      const itemId = createId('item');
      await tx.execute(
        `INSERT INTO expense_items (id, expense_id, name, amount, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          expenseId,
          item.name.trim(),
          Math.round(item.amount),
          item.position ?? index,
          timestamp,
        ]
      );
      for (const participantId of item.assignedTo) {
        await tx.execute(
          `INSERT OR IGNORE INTO expense_item_assignments (id, item_id, participant_id)
             VALUES (?, ?, ?)`,
          [createId('assign'), itemId, participantId]
        );
      }
    }
  }

  /** Soft delete: the row stays so the record of what happened is not lost. */
  async remove(id: ExpenseId): Promise<void> {
    const timestamp = nowIso();
    await this.db.execute(
      `UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [timestamp, timestamp, id]
    );
  }

  async restore(id: ExpenseId): Promise<void> {
    await this.db.execute(`UPDATE expenses SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [
      nowIso(),
      id,
    ]);
  }

  async setReceipt(id: ExpenseId, receiptUri: string | null): Promise<void> {
    await this.db.execute(`UPDATE expenses SET receipt_uri = ?, updated_at = ? WHERE id = ?`, [
      receiptUri,
      nowIso(),
      id,
    ]);
  }
}
