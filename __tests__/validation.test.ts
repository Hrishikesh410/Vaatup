import type { Person } from '@/types/person';
import { toMinorUnits } from '@/utils/currency';
import {
  validateBillAmount,
  validatePayers,
  validatePeople,
  validatePersonName,
  validateSplit,
} from '@/utils/validation';

const rs = (amount: number) => toMinorUnits(amount);

const roster: Person[] = [
  { id: 'p1', name: 'Hrishikesh' },
  { id: 'p2', name: 'Rahul' },
  { id: 'p3', name: 'Amit' },
];

describe('validateBillAmount', () => {
  it('rejects an empty bill', () => {
    expect(validateBillAmount(null)).toEqual({
      valid: false,
      message: 'Enter a bill amount.',
    });
  });

  it('rejects a zero bill', () => {
    expect(validateBillAmount(0).valid).toBe(false);
  });

  it('accepts a real amount', () => {
    expect(validateBillAmount(rs(2460))).toEqual({ valid: true });
  });
});

describe('validatePeople and validatePersonName', () => {
  it('needs at least one person', () => {
    expect(validatePeople([]).valid).toBe(false);
    expect(validatePeople(roster).valid).toBe(true);
  });

  it('rejects blank and duplicate names', () => {
    expect(validatePersonName('   ', roster).valid).toBe(false);
    expect(validatePersonName('rahul', roster).valid).toBe(false);
    expect(validatePersonName('Neha', roster).valid).toBe(true);
  });

  it('lets a person keep their own name while editing', () => {
    expect(validatePersonName('Rahul', roster, 'p2').valid).toBe(true);
  });
});

describe('validateSplit', () => {
  const base = {
    total: rs(1000),
    people: roster,
    exactAmounts: {},
    percentages: {},
    shareCounts: {},
  };

  it('always allows an equal split of a valid bill', () => {
    expect(validateSplit({ ...base, splitType: 'equal' }).valid).toBe(true);
  });

  it('accepts a balanced exact split', () => {
    const result = validateSplit({
      ...base,
      splitType: 'exact',
      exactAmounts: { p1: rs(500), p2: rs(300), p3: rs(200) },
    });
    expect(result.valid).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('blocks an unbalanced exact split and reports the gap', () => {
    const result = validateSplit({
      ...base,
      splitType: 'exact',
      exactAmounts: { p1: rs(500), p2: rs(300), p3: rs(100) },
    });
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Split doesn't balance.");
    expect(result.remaining).toBe(rs(100));
  });

  it('accepts percentages totalling 100', () => {
    const result = validateSplit({
      ...base,
      splitType: 'percentage',
      percentages: { p1: 50, p2: 30, p3: 20 },
    });
    expect(result.valid).toBe(true);
  });

  it('blocks percentages that do not total 100', () => {
    const result = validateSplit({
      ...base,
      splitType: 'percentage',
      percentages: { p1: 50, p2: 30, p3: 30 },
    });
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Percentages must total 100%.');
    expect(result.percentTotal).toBe(110);
  });

  it('accepts fractional percentages that still add to 100', () => {
    const result = validateSplit({
      ...base,
      splitType: 'percentage',
      percentages: { p1: 33.34, p2: 33.33, p3: 33.33 },
    });
    expect(result.valid).toBe(true);
  });

  it('reports the bill problem before the split problem', () => {
    const result = validateSplit({ ...base, total: 0, splitType: 'equal' });
    expect(result.message).toBe('Bill amount must be more than zero.');
  });

  it('accepts a shares split with any positive share counts', () => {
    const result = validateSplit({
      ...base,
      splitType: 'shares',
      shareCounts: { p1: 2, p2: 1, p3: 1 },
    });
    expect(result.valid).toBe(true);
    expect(result.shareTotal).toBe(4);
  });

  it('blocks a shares split where nobody has a share', () => {
    const result = validateSplit({
      ...base,
      splitType: 'shares',
      shareCounts: { p1: 0, p2: 0, p3: 0 },
    });
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Give at least one person a share.');
  });
});

describe('validatePayers', () => {
  it('accepts a single payer covering the whole bill', () => {
    expect(validatePayers([{ participantId: 'p1', amountPaid: rs(1000) }], rs(1000)).valid).toBe(
      true
    );
  });

  it('accepts several payers whose payments add up', () => {
    const payers = [
      { participantId: 'p1', amountPaid: rs(600) },
      { participantId: 'p2', amountPaid: rs(400) },
    ];
    expect(validatePayers(payers, rs(1000)).valid).toBe(true);
  });

  it('blocks payments that do not add up to the total', () => {
    const payers = [
      { participantId: 'p1', amountPaid: rs(600) },
      { participantId: 'p2', amountPaid: rs(300) },
    ];
    const result = validatePayers(payers, rs(1000));
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Payments don't add up to the total.");
  });

  it('needs somebody to have paid', () => {
    expect(validatePayers([], rs(1000)).valid).toBe(false);
  });

  it('rejects a negative payment', () => {
    const payers = [
      { participantId: 'p1', amountPaid: rs(1200) },
      { participantId: 'p2', amountPaid: rs(-200) },
    ];
    expect(validatePayers(payers, rs(1000)).valid).toBe(false);
  });
});
