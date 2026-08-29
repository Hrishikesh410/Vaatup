import { DatabaseError } from '@/database';
import { SettlementError, StorageError, isDomainError } from '@/domain/errors';
import { getRepositories } from '@/repositories';
import type { ExpenseId } from '@/types/expense';
import type { GroupId } from '@/types/group';
import type { ParticipantId } from '@/types/participant';
import type { Settlement, SettlementInput } from '@/types/settlement';
import { roundSplitAmounts } from '@/utils/calculations';

/**
 * Recording that money changed hands.
 *
 * A settlement never edits or removes the expense behind it: the expense says
 * what was consumed, the settlement says what has since been paid, and the
 * balance engine reads both. That is why marking a share paid adds a row here
 * instead of mutating the expense.
 */

async function asApplicationError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isDomainError(error)) throw error;
    if (error instanceof DatabaseError) {
      throw new StorageError('Could not record that payment.', error);
    }
    throw error;
  }
}

export async function recordSettlement(
  ownerUserId: string,
  input: SettlementInput
): Promise<Settlement> {
  if (input.amount <= 0) throw new SettlementError('Enter an amount to settle.');
  const { settlements } = await getRepositories();
  return asApplicationError(() => settlements.create(ownerUserId, input));
}

export async function listSettlements(
  ownerUserId: string,
  options: { groupId?: GroupId; limit?: number } = {}
): Promise<Settlement[]> {
  const { settlements } = await getRepositories();
  return asApplicationError(() => settlements.list(ownerUserId, options));
}

export async function deleteSettlement(id: string): Promise<void> {
  const { settlements } = await getRepositories();
  await asApplicationError(() => settlements.remove(id));
}

/**
 * Marks one person's share of one expense as paid.
 *
 * Their share is owed to whoever paid for the expense, and with several payers
 * it is owed to each in proportion to what they put in — so this can create
 * more than one settlement, split with the same rounding as the expense itself.
 * A person who paid for the expense owes nothing on their own payment.
 */
export async function markShareSettled(
  ownerUserId: string,
  expenseId: ExpenseId,
  participantId: ParticipantId
): Promise<Settlement[]> {
  const { expenses, settlements } = await getRepositories();
  const expense = await asApplicationError(() => expenses.getById(expenseId));
  if (!expense) throw new SettlementError('That expense no longer exists.');

  const share = expense.splits.find((split) => split.personId === participantId);
  if (!share || share.amount <= 0) return [];

  const payers = expense.payers.filter(
    (payer) => payer.amountPaid > 0 && payer.participantId !== participantId
  );
  if (payers.length === 0) return [];

  const owedToEachPayer = roundSplitAmounts(
    share.amount,
    payers.map((payer) => payer.amountPaid)
  );

  const created: Settlement[] = [];
  for (const [index, payer] of payers.entries()) {
    const amount = owedToEachPayer[index] ?? 0;
    if (amount <= 0) continue;
    created.push(
      await asApplicationError(() =>
        settlements.create(ownerUserId, {
          groupId: expense.groupId,
          expenseId,
          fromParticipantId: participantId,
          toParticipantId: payer.participantId,
          amount,
          currencyCode: expense.currencyCode,
          notes: `Share of ${expense.description}`,
        })
      )
    );
  }
  return created;
}

/** Undoes {@link markShareSettled} for one person on one expense. */
export async function unmarkShareSettled(
  expenseId: ExpenseId,
  participantId: ParticipantId
): Promise<void> {
  const { settlements } = await getRepositories();
  await asApplicationError(() => settlements.removeForExpenseParticipant(expenseId, participantId));
}

/** Who has been marked paid on an expense, for rendering the result screen. */
export async function settledParticipantIds(expenseId: ExpenseId): Promise<ParticipantId[]> {
  const { settlements } = await getRepositories();
  const rows = await asApplicationError(() => settlements.listForExpense(expenseId));
  return [...new Set(rows.map((row) => row.fromParticipantId))];
}
