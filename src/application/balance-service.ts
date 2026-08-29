import { calculateBalances, calculatePairwiseDebts, debtBetween } from '@/domain/balance';
import { simplifyDebts } from '@/domain/debt-simplification';
import { getRepositories } from '@/repositories';
import type { BalanceSheet, SettlementSuggestion } from '@/types/balance';
import type { GroupId } from '@/types/group';
import type { Money } from '@/types/money';
import type { Participant, ParticipantId } from '@/types/participant';

/**
 * Balances, as the UI needs them.
 *
 * The arithmetic lives in `domain/balance` and `domain/debt-simplification`;
 * this service's job is to fetch the right expenses and settlements for a scope
 * and attach names. No screen adds up money itself.
 */

export interface BalanceScope {
  groupId?: GroupId;
}

async function loadLedgerRows(ownerUserId: string, scope: BalanceScope) {
  const { expenses, settlements } = await getRepositories();
  const [expenseRows, settlementRows] = await Promise.all([
    expenses.list(ownerUserId, { groupId: scope.groupId }),
    settlements.list(ownerUserId, { groupId: scope.groupId }),
  ]);
  return { expenseRows, settlementRows };
}

export async function getBalanceSheet(
  ownerUserId: string,
  scope: BalanceScope = {}
): Promise<BalanceSheet> {
  const { expenseRows, settlementRows } = await loadLedgerRows(ownerUserId, scope);
  return calculateBalances(expenseRows, settlementRows);
}

/** Suggested payments that clear the scope in as few transfers as possible. */
export async function getSettlementSuggestions(
  ownerUserId: string,
  scope: BalanceScope = {}
): Promise<SettlementSuggestion[]> {
  const sheet = await getBalanceSheet(ownerUserId, scope);
  return simplifyDebts(sheet.balances);
}

export interface PersonBalance {
  participant: Participant;
  /** Positive: they owe the user. Negative: the user owes them. */
  net: Money;
}

export interface BalanceOverview {
  /** Total the user is owed by others. */
  owed: Money;
  /** Total the user owes others. */
  owes: Money;
  /** `owed - owes`. */
  net: Money;
  /** Everyone with a non-zero position, biggest creditor of the user first. */
  people: PersonBalance[];
}

/**
 * The user's position, person by person.
 *
 * Net balances alone cannot say who owes whom, so this uses the pairwise debts:
 * each person's share of an expense is attributed to whoever actually paid for
 * it. The totals still reconcile with the user's own net balance.
 */
export async function getBalanceOverview(
  ownerUserId: string,
  scope: BalanceScope = {}
): Promise<BalanceOverview> {
  const { participants } = await getRepositories();
  const [self, everyone, { expenseRows, settlementRows }] = await Promise.all([
    participants.getSelf(ownerUserId),
    participants.listAll(ownerUserId),
    loadLedgerRows(ownerUserId, scope),
  ]);

  if (!self) return { owed: 0, owes: 0, net: 0, people: [] };

  const debts = calculatePairwiseDebts(expenseRows, settlementRows);
  const people: PersonBalance[] = [];
  let owed = 0;
  let owes = 0;

  for (const participant of everyone) {
    if (participant.id === self.id) continue;
    const net = debtBetween(debts, self.id, participant.id);
    if (net === 0) continue;
    if (net > 0) owed += net;
    else owes -= net;
    people.push({ participant, net });
  }

  people.sort(
    (first, second) =>
      second.net - first.net || first.participant.name.localeCompare(second.participant.name)
  );
  return { owed, owes, net: owed - owes, people };
}

/** What one person owes the user, or the user owes them, within a scope. */
export async function getPersonBalance(
  ownerUserId: string,
  participantId: ParticipantId,
  scope: BalanceScope = {}
): Promise<Money> {
  const { participants } = await getRepositories();
  const self = await participants.getSelf(ownerUserId);
  if (!self) return 0;

  const { expenseRows, settlementRows } = await loadLedgerRows(ownerUserId, scope);
  return debtBetween(calculatePairwiseDebts(expenseRows, settlementRows), self.id, participantId);
}

export interface NamedBalance {
  participant: Participant;
  paid: Money;
  owed: Money;
  net: Money;
}

/** A group's balance sheet with names attached, for the group screen. */
export async function getGroupBalances(
  ownerUserId: string,
  groupId: GroupId
): Promise<NamedBalance[]> {
  const { participants } = await getRepositories();
  const [everyone, sheet] = await Promise.all([
    participants.listAll(ownerUserId),
    getBalanceSheet(ownerUserId, { groupId }),
  ]);

  return sheet.balances.flatMap((balance) => {
    const participant = everyone.find((person) => person.id === balance.participantId);
    if (!participant) return [];
    return [{ participant, paid: balance.paid, owed: balance.owed, net: balance.net }];
  });
}
