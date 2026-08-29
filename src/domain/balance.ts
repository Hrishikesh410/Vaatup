import type { BalanceSheet, PairwiseDebt, ParticipantBalance } from '@/types/balance';
import type { Expense } from '@/types/expense';
import type { Money } from '@/types/money';
import type { ParticipantId } from '@/types/participant';
import type { Settlement } from '@/types/settlement';
import { roundSplitAmounts } from '@/utils/calculations';

/**
 * The balance engine.
 *
 * Balances are always derived from the records that caused them — never stored,
 * never edited directly — so they cannot disagree with the expense and
 * settlement history. Everything here is a pure function over rows the
 * repository has already filtered (deleted records must not be passed in).
 *
 *   net = paid - owed + settled out - settled in
 *
 * Positive means the participant is owed money. Negative means they owe.
 */

function emptyBalance(participantId: ParticipantId): ParticipantBalance {
  return {
    participantId,
    paid: 0,
    owed: 0,
    settledOut: 0,
    settledIn: 0,
    net: 0,
  };
}

export function calculateBalances(
  expenses: Expense[],
  settlements: Settlement[] = []
): BalanceSheet {
  const byParticipant = new Map<ParticipantId, ParticipantBalance>();
  const balanceFor = (participantId: ParticipantId): ParticipantBalance => {
    const existing = byParticipant.get(participantId);
    if (existing) return existing;
    const created = emptyBalance(participantId);
    byParticipant.set(participantId, created);
    return created;
  };

  for (const expense of expenses) {
    for (const payer of expense.payers) {
      balanceFor(payer.participantId).paid += payer.amountPaid;
    }
    for (const split of expense.splits) {
      balanceFor(split.personId).owed += split.amount;
    }
  }

  for (const settlement of settlements) {
    balanceFor(settlement.fromParticipantId).settledOut += settlement.amount;
    balanceFor(settlement.toParticipantId).settledIn += settlement.amount;
  }

  let totalCredit = 0;
  let totalDebt = 0;
  const balances = [...byParticipant.values()].map((balance) => {
    const net = balance.paid - balance.owed + balance.settledOut - balance.settledIn;
    if (net > 0) totalCredit += net;
    if (net < 0) totalDebt -= net;
    return { ...balance, net };
  });

  // Biggest creditor first, then by id so the order never depends on insertion.
  balances.sort(
    (first, second) =>
      second.net - first.net || first.participantId.localeCompare(second.participantId)
  );

  return { balances, totalCredit, totalDebt };
}

export function netFor(sheet: BalanceSheet, participantId: ParticipantId): Money {
  return sheet.balances.find((balance) => balance.participantId === participantId)?.net ?? 0;
}

/** Map key for "this person owes that person". */
function debtKey(debtor: ParticipantId, creditor: ParticipantId): string {
  return `${debtor}\u0000${creditor}`;
}

/**
 * Who owes whom, person to person.
 *
 * A net balance says someone is owed ₹500 but not by whom, which is exactly
 * what the friends list needs to know. With several payers on one expense, each
 * person's share is attributed across the payers in proportion to what each
 * payer put in — distributed with the same largest-remainder rounding as the
 * split itself, so no paisa is invented or lost.
 *
 * Debts are netted per pair: if A owes B ₹300 and B owes A ₹100, the result is
 * A owes B ₹200.
 */
export function calculatePairwiseDebts(
  expenses: Expense[],
  settlements: Settlement[] = []
): PairwiseDebt[] {
  const grossDebts = new Map<string, Money>();
  const addDebt = (debtor: ParticipantId, creditor: ParticipantId, amount: Money): void => {
    if (amount <= 0 || debtor === creditor) return;
    const mapKey = debtKey(debtor, creditor);
    grossDebts.set(mapKey, (grossDebts.get(mapKey) ?? 0) + amount);
  };

  for (const expense of expenses) {
    const payers = expense.payers.filter((payer) => payer.amountPaid > 0);
    if (payers.length === 0) continue;

    for (const split of expense.splits) {
      if (split.amount <= 0) continue;
      const owedToEachPayer = roundSplitAmounts(
        split.amount,
        payers.map((payer) => payer.amountPaid)
      );
      payers.forEach((payer, index) => {
        addDebt(split.personId, payer.participantId, owedToEachPayer[index] ?? 0);
      });
    }
  }

  for (const settlement of settlements) {
    // Paying someone reduces what you owe them, and can push past zero into
    // them owing you, which the netting below resolves.
    addDebt(settlement.toParticipantId, settlement.fromParticipantId, settlement.amount);
  }

  const nettedDebts: PairwiseDebt[] = [];
  const alreadyNetted = new Set<string>();

  for (const mapKey of grossDebts.keys()) {
    if (alreadyNetted.has(mapKey)) continue;
    const [debtor, creditor] = mapKey.split('\u0000');
    const reverseKey = debtKey(creditor, debtor);
    alreadyNetted.add(mapKey);
    alreadyNetted.add(reverseKey);

    const amount = (grossDebts.get(mapKey) ?? 0) - (grossDebts.get(reverseKey) ?? 0);
    if (amount > 0) {
      nettedDebts.push({
        fromParticipantId: debtor,
        toParticipantId: creditor,
        amount,
      });
    }
    if (amount < 0) {
      nettedDebts.push({
        fromParticipantId: creditor,
        toParticipantId: debtor,
        amount: -amount,
      });
    }
  }

  nettedDebts.sort(
    (first, second) =>
      second.amount - first.amount ||
      first.fromParticipantId.localeCompare(second.fromParticipantId) ||
      first.toParticipantId.localeCompare(second.toParticipantId)
  );

  return nettedDebts;
}

/**
 * What `other` owes `subject`, as a signed amount. Positive means `other` owes
 * `subject`; negative means `subject` owes `other`.
 */
export function debtBetween(
  debts: PairwiseDebt[],
  subject: ParticipantId,
  other: ParticipantId
): Money {
  let net = 0;
  for (const debt of debts) {
    if (debt.fromParticipantId === other && debt.toParticipantId === subject) net += debt.amount;
    if (debt.fromParticipantId === subject && debt.toParticipantId === other) net -= debt.amount;
  }
  return net;
}
