import type { Person } from '@/types/person';
import type { Share } from '@/types/split';
import { toMinorUnits } from '@/utils/currency';
import { isPaid, keepPaidFor, paidStatus, togglePaidId } from '@/utils/paid';

const rs = (amount: number) => toMinorUnits(amount);

const people: Person[] = [
  { id: 'p1', name: 'Hrishikesh' },
  { id: 'p2', name: 'Rahul' },
  { id: 'p3', name: 'Amit' },
];

const shares: Share[] = [
  { personId: 'p1', amount: rs(1000), inputValue: 1 },
  { personId: 'p2', amount: rs(600), inputValue: 1 },
  { personId: 'p3', amount: rs(400), inputValue: 1 },
];

describe('togglePaidId', () => {
  it('marks someone paid, then unpaid again', () => {
    const once = togglePaidId([], 'p1');
    expect(once).toEqual(['p1']);
    expect(togglePaidId(once, 'p1')).toEqual([]);
  });

  it('never records the same person twice', () => {
    expect(togglePaidId(['p1'], 'p2')).toEqual(['p1', 'p2']);
    expect(togglePaidId(['p1', 'p2'], 'p1')).toEqual(['p2']);
  });

  it('leaves the original list untouched', () => {
    const paid = ['p1'];
    togglePaidId(paid, 'p2');
    expect(paid).toEqual(['p1']);
  });
});

describe('keepPaidFor', () => {
  it('drops people who are no longer on the bill', () => {
    expect(keepPaidFor(['p1', 'gone', 'p3'], people)).toEqual(['p1', 'p3']);
  });
});

describe('paidStatus', () => {
  it('reports nothing collected when the split is new', () => {
    expect(paidStatus(people, shares, [])).toEqual({
      paidCount: 0,
      peopleCount: 3,
      collected: 0,
      outstanding: rs(2000),
      settled: false,
    });
  });

  it('splits the total between collected and outstanding', () => {
    expect(paidStatus(people, shares, ['p2'])).toMatchObject({
      paidCount: 1,
      collected: rs(600),
      outstanding: rs(1400),
      settled: false,
    });
  });

  it('settles only once everyone has paid', () => {
    expect(paidStatus(people, shares, ['p1', 'p2'])).toMatchObject({
      settled: false,
    });
    expect(paidStatus(people, shares, ['p1', 'p2', 'p3'])).toMatchObject({
      paidCount: 3,
      collected: rs(2000),
      outstanding: 0,
      settled: true,
    });
  });

  it('ignores paid ids that are not on the bill', () => {
    expect(paidStatus(people, shares, ['ghost'])).toMatchObject({
      paidCount: 0,
      collected: 0,
      outstanding: rs(2000),
      settled: false,
    });
  });

  it('is never settled with nobody on the bill', () => {
    expect(paidStatus([], [], [])).toMatchObject({
      settled: false,
      outstanding: 0,
    });
  });
});

describe('isPaid', () => {
  it('answers per person', () => {
    expect(isPaid(['p1'], 'p1')).toBe(true);
    expect(isPaid(['p1'], 'p2')).toBe(false);
  });
});
