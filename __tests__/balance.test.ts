import { calculateBalances, calculatePairwiseDebts } from '@/domain/balance';
import type { Expense, ExpensePayer, ExpenseSplit } from '@/types/expense';
import type { Settlement } from '@/types/settlement';
import { toMinorUnits } from '@/utils/currency';

const rs = (amount: number) => toMinorUnits(amount);

let sequence = 0;

/**
 * Only the fields the balance engine reads matter here, so the rest are filled
 * in with defaults to keep each test about the money.
 */
function expense(
  total: number,
  payers: Record<string, number>,
  splits: Record<string, number>
): Expense {
  sequence += 1;
  const timestamp = '2026-01-01T00:00:00.000Z';

  const payerRows: ExpensePayer[] = Object.entries(payers).map(([participantId, amount]) => ({
    participantId,
    amountPaid: rs(amount),
  }));

  const splitRows: ExpenseSplit[] = Object.entries(splits).map(([personId, amount]) => ({
    personId,
    amount: rs(amount),
    inputValue: rs(amount),
    splitType: 'exact',
  }));

  return {
    id: `expense-${sequence}`,
    ownerUserId: 'user-1',
    description: `Expense ${sequence}`,
    totalAmount: rs(total),
    baseAmount: rs(total),
    tipAmount: 0,
    taxAmount: 0,
    currencyCode: 'INR',
    splitType: 'exact',
    categoryId: 'category-general',
    spentAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    payers: payerRows,
    splits: splitRows,
    items: [],
  };
}

function settlement(from: string, to: string, amount: number): Settlement {
  sequence += 1;
  const timestamp = '2026-01-02T00:00:00.000Z';
  return {
    id: `settlement-${sequence}`,
    ownerUserId: 'user-1',
    fromParticipantId: from,
    toParticipantId: to,
    amount: rs(amount),
    currencyCode: 'INR',
    settledAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('calculateBalances', () => {
  it('has one person owed what the others owe them', () => {
    const sheet = calculateBalances([
      expense(900, { aditi: 900 }, { aditi: 300, rahul: 300, neha: 300 }),
    ]);

    expect(sheet.balances).toEqual([
      {
        participantId: 'aditi',
        paid: rs(900),
        owed: rs(300),
        settledOut: 0,
        settledIn: 0,
        net: rs(600),
      },
      {
        participantId: 'neha',
        paid: 0,
        owed: rs(300),
        settledOut: 0,
        settledIn: 0,
        net: rs(-300),
      },
      {
        participantId: 'rahul',
        paid: 0,
        owed: rs(300),
        settledOut: 0,
        settledIn: 0,
        net: rs(-300),
      },
    ]);
  });

  it('always nets to zero across everyone', () => {
    const sheet = calculateBalances(
      [
        expense(900, { aditi: 900 }, { aditi: 300, rahul: 300, neha: 300 }),
        expense(500, { rahul: 200, neha: 300 }, { aditi: 250, rahul: 250 }),
      ],
      [settlement('rahul', 'aditi', 120)]
    );

    const total = sheet.balances.reduce((sum, balance) => sum + balance.net, 0);
    expect(total).toBe(0);
  });

  it('counts a settlement as money that has already changed hands', () => {
    const expenses = [expense(600, { aditi: 600 }, { aditi: 300, rahul: 300 })];

    const before = calculateBalances(expenses);
    expect(before.balances.find((balance) => balance.participantId === 'rahul')?.net).toBe(
      rs(-300)
    );

    const after = calculateBalances(expenses, [settlement('rahul', 'aditi', 300)]);
    expect(after.balances.every((balance) => balance.net === 0)).toBe(true);
  });

  it('has nothing to say about an empty history', () => {
    expect(calculateBalances([]).balances).toEqual([]);
  });
});

describe('calculatePairwiseDebts', () => {
  it('points each share at whoever paid', () => {
    const debts = calculatePairwiseDebts([
      expense(900, { aditi: 900 }, { aditi: 300, rahul: 300, neha: 300 }),
    ]);

    expect(debts).toEqual([
      { fromParticipantId: 'neha', toParticipantId: 'aditi', amount: rs(300) },
      { fromParticipantId: 'rahul', toParticipantId: 'aditi', amount: rs(300) },
    ]);
  });

  it('divides a share between payers in proportion to what they put in', () => {
    const debts = calculatePairwiseDebts([
      expense(1000, { aditi: 750, rahul: 250 }, { aditi: 500, rahul: 250, neha: 250 }),
    ]);

    const nehaOwes = debts.filter((debt) => debt.fromParticipantId === 'neha');
    expect(nehaOwes).toEqual([
      {
        fromParticipantId: 'neha',
        toParticipantId: 'aditi',
        amount: rs(187.5),
      },
      { fromParticipantId: 'neha', toParticipantId: 'rahul', amount: rs(62.5) },
    ]);
    expect(nehaOwes.reduce((sum, debt) => sum + debt.amount, 0)).toBe(rs(250));
  });

  it('cancels debts that run both ways', () => {
    const debts = calculatePairwiseDebts([
      expense(600, { aditi: 600 }, { aditi: 300, rahul: 300 }),
      expense(400, { rahul: 400 }, { aditi: 200, rahul: 200 }),
    ]);

    expect(debts).toEqual([
      { fromParticipantId: 'rahul', toParticipantId: 'aditi', amount: rs(100) },
    ]);
  });

  it('lets a settlement push a balance the other way', () => {
    const debts = calculatePairwiseDebts(
      [expense(600, { aditi: 600 }, { aditi: 300, rahul: 300 })],
      [settlement('rahul', 'aditi', 500)]
    );

    expect(debts).toEqual([
      { fromParticipantId: 'aditi', toParticipantId: 'rahul', amount: rs(200) },
    ]);
  });

  it('says nothing about a person who only owes themselves', () => {
    const debts = calculatePairwiseDebts([expense(400, { aditi: 400 }, { aditi: 400 })]);
    expect(debts).toEqual([]);
  });
});
