import type { ParticipantBalance, SettlementSuggestion } from '@/types/balance';

/**
 * Turns net balances into the payments that clear them.
 *
 * Showing every raw debt in a group of five people can mean a dozen transfers
 * where three would do. This matches the largest debtor to the largest creditor
 * repeatedly, which clears at least one person per step and therefore needs at
 * most `n - 1` transfers.
 *
 * The result is deterministic: ties are broken by participant id, so the same
 * balances always produce the same suggestions in the same order.
 */
export function simplifyDebts(balances: ParticipantBalance[]): SettlementSuggestion[] {
  const byLargestAmountThenId = (
    first: { participantId: string; amount: number },
    second: { participantId: string; amount: number }
  ) => second.amount - first.amount || first.participantId.localeCompare(second.participantId);

  const debtors = balances
    .filter((balance) => balance.net < 0)
    .map((balance) => ({
      participantId: balance.participantId,
      amount: -balance.net,
    }))
    .sort(byLargestAmountThenId);

  const creditors = balances
    .filter((balance) => balance.net > 0)
    .map((balance) => ({
      participantId: balance.participantId,
      amount: balance.net,
    }))
    .sort(byLargestAmountThenId);

  const suggestions: SettlementSuggestion[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      suggestions.push({
        fromParticipantId: debtor.participantId,
        toParticipantId: creditor.participantId,
        amount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }

  return suggestions;
}
