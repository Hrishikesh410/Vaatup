import { DatabaseError } from '@/database';
import { StorageError, isDomainError } from '@/domain/errors';
import { getRepositories } from '@/repositories';
import { nextOccurrence } from '@/domain/recurrence';
import type { Expense } from '@/types/expense';
import type {
  RecurrenceFrequency,
  RecurringExpense,
  RecurringExpenseInput,
} from '@/types/recurring';
import { nowIso } from '@/utils/date';

import { createExpense } from './expense-service';

/**
 * Repeating expenses: rent, internet, a subscription.
 *
 * Nothing runs in the background. {@link materialiseDueExpenses} is called when
 * the app opens and creates whatever became due while it was closed, catching up
 * period by period so a month away produces a month of rent rather than one
 * charge. When a backend exists, the same loop moves server-side and this
 * becomes a no-op.
 */

const MAX_CATCH_UP = 24;

async function asApplicationError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isDomainError(error)) throw error;
    if (error instanceof DatabaseError) {
      throw new StorageError('Could not save that repeating expense.', error);
    }
    throw error;
  }
}

export async function listRecurring(ownerUserId: string): Promise<RecurringExpense[]> {
  const { recurring } = await getRepositories();
  return asApplicationError(() => recurring.list(ownerUserId));
}

export async function saveRecurring(
  ownerUserId: string,
  input: RecurringExpenseInput,
  id?: string
): Promise<RecurringExpense> {
  const { recurring } = await getRepositories();
  return asApplicationError(() =>
    id ? recurring.update(id, input) : recurring.create(ownerUserId, input)
  );
}

/**
 * Sets up a repeat of an expense that has already happened.
 *
 * The expense itself is left alone — this copies its shape (amount, payers,
 * splits, category, group) into a template, with the first repeat one period
 * after the original was spent.
 */
export async function repeatExpense(
  ownerUserId: string,
  expense: Expense,
  frequency: RecurrenceFrequency
): Promise<RecurringExpense> {
  return saveRecurring(ownerUserId, {
    groupId: expense.groupId,
    description: expense.description,
    totalAmount: expense.totalAmount,
    currencyCode: expense.currencyCode,
    categoryId: expense.categoryId,
    splitType: expense.splitType,
    frequency,
    notes: expense.notes,
    payers: expense.payers,
    splits: expense.splits.map((split) => ({
      personId: split.personId,
      amount: split.amount,
      inputValue: split.inputValue,
    })),
    nextDueAt: nextOccurrence(expense.spentAt, frequency),
  });
}

export async function setRecurringActive(id: string, isActive: boolean): Promise<void> {
  const { recurring } = await getRepositories();
  await asApplicationError(() => recurring.setActive(id, isActive));
}

export async function removeRecurring(id: string): Promise<void> {
  const { recurring } = await getRepositories();
  await asApplicationError(() => recurring.remove(id));
}

/**
 * Creates the expenses that have come due, and returns them.
 *
 * Each generated expense goes through the normal expense use case, so a
 * template that no longer balances (someone was removed, say) is rejected
 * rather than written as a broken expense.
 */
export async function materialiseDueExpenses(ownerUserId: string): Promise<Expense[]> {
  const { recurring } = await getRepositories();
  const asOf = nowIso();
  const due = await asApplicationError(() => recurring.listDue(ownerUserId, asOf));

  const created: Expense[] = [];

  for (const template of due) {
    let dueAt = template.nextDueAt;
    let generated = 0;

    while (dueAt <= asOf && generated < MAX_CATCH_UP) {
      try {
        created.push(
          await createExpense(ownerUserId, {
            groupId: template.groupId,
            description: template.description,
            baseAmount: template.totalAmount,
            tipAmount: 0,
            taxAmount: 0,
            currencyCode: template.currencyCode,
            splitType: template.splitType,
            categoryId: template.categoryId,
            notes: template.notes,
            spentAt: dueAt,
            payers: template.payers,
            splits: template.splits,
          })
        );
      } catch {
        // A template that cannot produce a valid expense is skipped rather than
        // retried forever; the user can fix it on the repeating expense screen.
        break;
      }
      dueAt = nextOccurrence(dueAt, template.frequency);
      generated += 1;
    }

    if (generated > 0) {
      await asApplicationError(() => recurring.markRun(template.id, asOf, dueAt));
    }
  }

  return created;
}
