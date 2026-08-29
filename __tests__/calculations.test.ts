import type { Person } from '@/types/person';
import {
  calculateExactSplit,
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateRemaining,
  calculateSharesSplit,
  calculateTip,
  calculateTotal,
  roundSplitAmounts,
  sumPercentages,
  sumShares,
} from '@/utils/calculations';
import { toMinorUnits } from '@/utils/currency';

const people = (count: number): Person[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Person ${index + 1}`,
  }));

/** Rupees to paise, so tests read in the units a user would type. */
const rs = (amount: number) => toMinorUnits(amount);

describe('calculateEqualSplit', () => {
  it('splits 1000 between 2 people', () => {
    const shares = calculateEqualSplit(rs(1000), people(2));
    expect(shares.map((share) => share.amount)).toEqual([rs(500), rs(500)]);
  });

  it('splits 1000 between 3 people without losing a paisa', () => {
    const shares = calculateEqualSplit(rs(1000), people(3));
    expect(shares.map((share) => share.amount)).toEqual([rs(333.34), rs(333.33), rs(333.33)]);
    expect(sumShares(shares)).toBe(rs(1000));
  });

  it('splits 1001 between 3 people', () => {
    const shares = calculateEqualSplit(rs(1001), people(3));
    expect(shares.map((share) => share.amount)).toEqual([rs(333.67), rs(333.67), rs(333.66)]);
    expect(sumShares(shares)).toBe(rs(1001));
  });

  it('always reconciles to the total for awkward amounts', () => {
    for (const total of [1, 7, 99.99, 1000, 2460, 12345.67]) {
      for (const count of [1, 2, 3, 4, 5, 6, 7, 11]) {
        const shares = calculateEqualSplit(rs(total), people(count));
        expect(sumShares(shares)).toBe(rs(total));
      }
    }
  });

  it('returns nothing when there is nobody to split with', () => {
    expect(calculateEqualSplit(rs(500), [])).toEqual([]);
  });
});

describe('calculateExactSplit', () => {
  it('uses the amounts exactly as entered', () => {
    const roster = people(3);
    const shares = calculateExactSplit(roster, {
      p1: rs(500),
      p2: rs(300),
      p3: rs(200),
    });
    expect(sumShares(shares)).toBe(rs(1000));
  });

  it('treats a missing entry as zero', () => {
    const shares = calculateExactSplit(people(2), { p1: rs(400) });
    expect(shares.map((share) => share.amount)).toEqual([rs(400), 0]);
  });
});

describe('calculateRemaining', () => {
  it('is zero when the custom amounts balance', () => {
    const remaining = calculateRemaining(rs(1000), people(3), {
      p1: rs(500),
      p2: rs(300),
      p3: rs(200),
    });
    expect(remaining).toBe(0);
  });

  it('reports what is left when they do not', () => {
    const remaining = calculateRemaining(rs(1000), people(3), {
      p1: rs(500),
      p2: rs(300),
      p3: rs(100),
    });
    expect(remaining).toBe(rs(100));
  });

  it('goes negative when over-allocated', () => {
    const remaining = calculateRemaining(rs(1000), people(2), {
      p1: rs(700),
      p2: rs(400),
    });
    expect(remaining).toBe(rs(-100));
  });
});

describe('calculatePercentageSplit', () => {
  it('turns 40/20/20/20 into amounts', () => {
    const shares = calculatePercentageSplit(rs(2460), people(4), {
      p1: 40,
      p2: 20,
      p3: 20,
      p4: 20,
    });
    expect(shares.map((share) => share.amount)).toEqual([rs(984), rs(492), rs(492), rs(492)]);
    expect(sumShares(shares)).toBe(rs(2460));
  });

  it('handles 50/30/20', () => {
    const shares = calculatePercentageSplit(rs(1000), people(3), {
      p1: 50,
      p2: 30,
      p3: 20,
    });
    expect(shares.map((share) => share.amount)).toEqual([rs(500), rs(300), rs(200)]);
  });

  it('keeps the total exact with repeating percentages', () => {
    const shares = calculatePercentageSplit(rs(1000), people(3), {
      p1: 33.34,
      p2: 33.33,
      p3: 33.33,
    });
    expect(sumShares(shares)).toBe(rs(1000));
  });

  it('sums percentages for the balance hint', () => {
    expect(sumPercentages(people(3), { p1: 50, p2: 30, p3: 30 })).toBe(110);
    expect(sumPercentages(people(3), { p1: 50, p2: 30, p3: 20 })).toBe(100);
  });
});

describe('calculateSharesSplit', () => {
  it('gives a double share twice as much', () => {
    const shares = calculateSharesSplit(rs(1200), people(3), {
      p1: 2,
      p2: 1,
      p3: 1,
    });
    expect(shares.map((share) => share.amount)).toEqual([rs(600), rs(300), rs(300)]);
    expect(sumShares(shares)).toBe(rs(1200));
  });

  it('leaves out anyone with no shares', () => {
    const shares = calculateSharesSplit(rs(1000), people(3), {
      p1: 1,
      p2: 1,
      p3: 0,
    });
    expect(shares.map((share) => share.amount)).toEqual([rs(500), rs(500), 0]);
  });

  it('reconciles when the shares do not divide evenly', () => {
    const shares = calculateSharesSplit(rs(1000), people(3), {
      p1: 1,
      p2: 1,
      p3: 1,
    });
    expect(sumShares(shares)).toBe(rs(1000));
  });

  it('records the share count so the split can be reopened', () => {
    const shares = calculateSharesSplit(rs(900), people(2), { p1: 2, p2: 1 });
    expect(shares.map((share) => share.inputValue)).toEqual([2, 1]);
  });

  it('ignores fractional and negative share counts', () => {
    const shares = calculateSharesSplit(rs(600), people(2), {
      p1: 1.9,
      p2: -3,
    });
    expect(shares.map((share) => share.amount)).toEqual([rs(600), 0]);
  });
});

describe('roundSplitAmounts', () => {
  it('gives leftover minor units to the largest remainders first', () => {
    expect(roundSplitAmounts(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });

  it('never loses or invents money', () => {
    expect(roundSplitAmounts(100, [3, 1]).reduce((sum, amount) => sum + amount, 0)).toBe(100);
    expect(roundSplitAmounts(0, [1, 1])).toEqual([0, 0]);
  });

  it('falls back to an equal split when weights are unusable', () => {
    expect(roundSplitAmounts(100, [0, 0])).toEqual([50, 50]);
  });
});

describe('calculateTip and calculateTotal', () => {
  it('skips the tip entirely', () => {
    expect(calculateTip(rs(2400), { kind: 'none' })).toBe(0);
  });

  it('calculates a percentage tip', () => {
    expect(calculateTip(rs(2400), { kind: 'percent', percent: 10 })).toBe(rs(240));
    expect(calculateTip(rs(2400), { kind: 'percent', percent: 2.5 })).toBe(rs(60));
  });

  it('accepts a flat tip amount', () => {
    expect(calculateTip(rs(2400), { kind: 'amount', amount: rs(60) })).toBe(rs(60));
  });

  it('adds tip and tax to the bill', () => {
    const totals = calculateTotal({
      base: rs(2400),
      tip: { kind: 'amount', amount: rs(60) },
      tax: rs(0),
    });
    expect(totals).toEqual({
      base: rs(2400),
      tip: rs(60),
      tax: 0,
      total: rs(2460),
    });
  });

  it('ignores negative input', () => {
    const totals = calculateTotal({
      base: rs(-100),
      tip: { kind: 'none' },
      tax: rs(-5),
    });
    expect(totals.total).toBe(0);
  });
});
