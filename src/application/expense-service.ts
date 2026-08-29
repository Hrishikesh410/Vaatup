import { DatabaseError } from '@/database';
import {
  ExpenseNotFoundError,
  InvalidAmountError,
  InvalidPayerError,
  InvalidSplitError,
  StorageError,
  isDomainError,
} from '@/domain/errors';
import { getRepositories } from '@/repositories';
import type { Category } from '@/types/category';
import type {
  Expense,
  ExpenseDetail,
  ExpenseFilters,
  ExpenseId,
  ExpenseInput,
} from '@/types/expense';
import type { Participant } from '@/types/participant';
import { calculateSplit, sumShares, type SplitInput } from '@/utils/calculations';
import { validatePayers, validateSplit } from '@/utils/validation';

/**
 * Use cases for expenses.
 *
 * The rules that decide whether an expense is allowed to exist live here rather
 * than in a screen, so the create flow, an edit, and a materialised recurring
 * expense are all held to the same standard. Infrastructure failures are
 * translated into domain errors on the way out.
 */

async function asApplicationError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isDomainError(error)) throw error;
    if (error instanceof DatabaseError) {
      throw new StorageError('Could not save to this device.', error);
    }
    throw error;
  }
}

/** Rejects an expense whose money does not add up, with a specific reason. */
export function assertExpenseIsValid(input: ExpenseInput): void {
  const total = input.baseAmount + input.tipAmount + input.taxAmount;
  if (total <= 0) throw new InvalidAmountError('Bill amount must be more than zero.');

  const owed = input.splits.reduce((sum, split) => sum + split.amount, 0);
  if (input.splits.length === 0) throw new InvalidSplitError('Add at least one person.');
  if (owed !== total) throw new InvalidSplitError("The split doesn't add up to the total.");

  const payers = validatePayers(input.payers, total);
  if (!payers.valid) throw new InvalidPayerError(payers.message ?? 'Check who paid.');

  const items = input.items ?? [];
  if (items.length > 0) {
    const itemised = items.reduce((sum, item) => sum + item.amount, 0);
    if (itemised > total) {
      throw new InvalidSplitError('The items add up to more than the expense.');
    }
  }
}

/**
 * Turns a split configuration into the amounts owed, then checks it balances.
 * Used by the create flow and by recurring expenses so both produce identical
 * numbers for identical input.
 */
export function resolveSplits(input: SplitInput): ExpenseInput['splits'] {
  const validation = validateSplit(input);
  if (!validation.valid) {
    throw new InvalidSplitError(validation.message ?? "The split doesn't balance.");
  }

  const { shares } = calculateSplit(input);
  if (sumShares(shares) !== input.total) {
    throw new InvalidSplitError("The split doesn't add up to the total.");
  }
  return shares;
}

export async function createExpense(ownerUserId: string, input: ExpenseInput): Promise<Expense> {
  assertExpenseIsValid(input);
  const { expenses } = await getRepositories();
  return asApplicationError(() => expenses.create(ownerUserId, input));
}

export async function updateExpense(id: ExpenseId, input: ExpenseInput): Promise<Expense> {
  assertExpenseIsValid(input);
  const { expenses } = await getRepositories();
  return asApplicationError(() => expenses.update(id, input));
}

export async function listExpenses(
  ownerUserId: string,
  filters?: ExpenseFilters
): Promise<Expense[]> {
  const { expenses } = await getRepositories();
  return asApplicationError(() => expenses.list(ownerUserId, filters));
}

export async function getExpense(id: ExpenseId): Promise<Expense | null> {
  const { expenses } = await getRepositories();
  return asApplicationError(() => expenses.getById(id));
}

/** An expense with the names, group and category a screen needs to render it. */
export async function getExpenseDetail(id: ExpenseId): Promise<ExpenseDetail> {
  const { expenses, participants, groups, categories } = await getRepositories();

  const expense = await asApplicationError(() => expenses.getById(id));
  if (!expense) throw new ExpenseNotFoundError('That expense no longer exists.');

  const involved = new Set([
    ...expense.payers.map((payer) => payer.participantId),
    ...expense.splits.map((split) => split.personId),
  ]);

  const [everyone, category, group] = await Promise.all([
    asApplicationError(() => participants.listAll(expense.ownerUserId)),
    asApplicationError(() => categories.getById(expense.categoryId)),
    expense.groupId
      ? asApplicationError(() => groups.getById(expense.groupId!))
      : Promise.resolve(null),
  ]);

  // A participant removed since the expense was created is still part of its
  // history, so fall back to a placeholder rather than dropping them.
  const resolved: Participant[] = [...involved].map(
    (participantId) =>
      everyone.find((person) => person.id === participantId) ??
      placeholderParticipant(participantId, expense.ownerUserId)
  );

  return {
    ...expense,
    participants: resolved,
    groupName: group?.name,
    categoryLabel: category?.label ?? 'Other',
    categoryIcon: category?.icon ?? '🧾',
  };
}

function placeholderParticipant(id: string, ownerUserId: string): Participant {
  return {
    id,
    ownerUserId,
    name: 'Removed person',
    isSelf: false,
    createdAt: '',
    updatedAt: '',
  };
}

/**
 * Soft delete. The expense stops appearing in history and stops counting
 * towards balances, but the record of what happened is not destroyed.
 */
export async function deleteExpense(id: ExpenseId): Promise<void> {
  const { expenses } = await getRepositories();
  await asApplicationError(() => expenses.remove(id));
}

export async function restoreExpense(id: ExpenseId): Promise<void> {
  const { expenses } = await getRepositories();
  await asApplicationError(() => expenses.restore(id));
}

export async function setExpenseReceipt(id: ExpenseId, receiptUri: string | null): Promise<void> {
  const { expenses } = await getRepositories();
  await asApplicationError(() => expenses.setReceipt(id, receiptUri));
}

export async function listCategories(): Promise<Category[]> {
  const { categories } = await getRepositories();
  return asApplicationError(() => categories.list());
}
