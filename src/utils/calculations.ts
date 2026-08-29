import type { BillTotals, Tip } from '@/types/bill';
import type { Money } from '@/types/money';
import type { Person } from '@/types/person';
import type {
  AmountMap,
  PercentageMap,
  Share,
  ShareCountMap,
  SplitResult,
  SplitType,
} from '@/types/split';

/**
 * Pure calculation engine. Nothing here imports React, React Native or the
 * database, so every function is directly unit testable and is reused by the
 * domain services that compute balances.
 *
 * All amounts are integer minor units. See `types/money.ts`.
 */

/** Percentages are compared as integer basis points to avoid float drift. */
const BASIS_POINTS_PER_PERCENT = 100;
const FULL_PERCENT_IN_BASIS_POINTS = 100 * BASIS_POINTS_PER_PERCENT;

export function toBasisPoints(percent: number): number {
  return Math.round(percent * BASIS_POINTS_PER_PERCENT);
}

export function calculateTip(base: Money, tip: Tip): Money {
  switch (tip.kind) {
    case 'none':
      return 0;
    case 'percent':
      return Math.round((base * tip.percent) / 100);
    case 'amount':
      return Math.max(0, Math.round(tip.amount));
  }
}

export function calculateTotal(input: { base: Money; tip: Tip; tax: Money }): BillTotals {
  const base = Math.max(0, Math.round(input.base));
  const tax = Math.max(0, Math.round(input.tax));
  const tip = calculateTip(base, input.tip);
  return { base, tip, tax, total: base + tip + tax };
}

/**
 * Distributes `total` across `weights` so that the parts sum to exactly `total`.
 *
 * Uses the largest-remainder method: every part gets the floor of its exact
 * share, then the leftover minor units go to the parts with the biggest
 * truncated remainders (ties broken by position). This is what makes
 * ₹1,000 across 3 people come out as 333.34 / 333.33 / 333.33.
 */
export function roundSplitAmounts(total: Money, weights: number[]): Money[] {
  const count = weights.length;
  if (count === 0) return [];

  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  let weightSum = safeWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    safeWeights.fill(1);
    weightSum = count;
  }

  const exact = safeWeights.map((weight) => (total * weight) / weightSum);
  const amounts = exact.map((value) => Math.floor(value));
  const allocated = amounts.reduce((sum, value) => sum + value, 0);
  let leftover = total - allocated;

  const byLargestRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((first, second) => second.remainder - first.remainder || first.index - second.index);

  for (const candidate of byLargestRemainder) {
    if (leftover <= 0) break;
    amounts[candidate.index] += 1;
    leftover -= 1;
  }

  return amounts;
}

export function calculateEqualSplit(total: Money, people: Person[]): Share[] {
  const amounts = roundSplitAmounts(
    total,
    people.map(() => 1)
  );
  return people.map((person, index) => ({
    personId: person.id,
    amount: amounts[index] ?? 0,
    inputValue: 1,
  }));
}

/** Exact amounts are used as typed; the total is validated separately. */
export function calculateExactSplit(people: Person[], amounts: AmountMap): Share[] {
  return people.map((person) => {
    const amount = Math.max(0, Math.round(amounts[person.id] ?? 0));
    return { personId: person.id, amount, inputValue: amount };
  });
}

export function calculatePercentageSplit(
  total: Money,
  people: Person[],
  percentages: PercentageMap
): Share[] {
  const weights = people.map((person) => toBasisPoints(percentages[person.id] ?? 0));
  const amounts = roundSplitAmounts(total, weights);
  return people.map((person, index) => ({
    personId: person.id,
    amount: amounts[index] ?? 0,
    inputValue: percentages[person.id] ?? 0,
  }));
}

/**
 * Splits by weight rather than by money: two shares gets twice as much as one.
 * Share counts are whole numbers, so ₹300 across 2 + 1 + 1 shares is
 * ₹150 / ₹75 / ₹75.
 */
export function calculateSharesSplit(
  total: Money,
  people: Person[],
  shareCounts: ShareCountMap
): Share[] {
  const weights = people.map((person) => Math.max(0, Math.trunc(shareCounts[person.id] ?? 0)));
  const amounts = roundSplitAmounts(total, weights);
  return people.map((person, index) => ({
    personId: person.id,
    amount: amounts[index] ?? 0,
    inputValue: weights[index] ?? 0,
  }));
}

export interface SplitInput {
  splitType: SplitType;
  total: Money;
  people: Person[];
  exactAmounts: AmountMap;
  percentages: PercentageMap;
  shareCounts: ShareCountMap;
}

export function calculateSplit(input: SplitInput): SplitResult {
  switch (input.splitType) {
    case 'equal':
      return {
        splitType: 'equal',
        shares: calculateEqualSplit(input.total, input.people),
      };
    case 'exact':
      return {
        splitType: 'exact',
        shares: calculateExactSplit(input.people, input.exactAmounts),
      };
    case 'percentage':
      return {
        splitType: 'percentage',
        shares: calculatePercentageSplit(input.total, input.people, input.percentages),
      };
    case 'shares':
      return {
        splitType: 'shares',
        shares: calculateSharesSplit(input.total, input.people, input.shareCounts),
      };
  }
}

export function sumShares(shares: Share[]): Money {
  return shares.reduce((sum, share) => sum + share.amount, 0);
}

export function sumAmounts(people: Person[], amounts: AmountMap): Money {
  return people.reduce((sum, person) => sum + Math.max(0, Math.round(amounts[person.id] ?? 0)), 0);
}

/** Signed gap between the bill total and the manually entered amounts. */
export function calculateRemaining(total: Money, people: Person[], amounts: AmountMap): Money {
  return total - sumAmounts(people, amounts);
}

export function sumPercentages(people: Person[], percentages: PercentageMap): number {
  const basisPoints = people.reduce(
    (sum, person) => sum + toBasisPoints(percentages[person.id] ?? 0),
    0
  );
  return basisPoints / BASIS_POINTS_PER_PERCENT;
}

export function percentagesBalance(people: Person[], percentages: PercentageMap): boolean {
  const basisPoints = people.reduce(
    (sum, person) => sum + toBasisPoints(percentages[person.id] ?? 0),
    0
  );
  return basisPoints === FULL_PERCENT_IN_BASIS_POINTS;
}

export function sumShareCounts(people: Person[], shareCounts: ShareCountMap): number {
  return people.reduce(
    (sum, person) => sum + Math.max(0, Math.trunc(shareCounts[person.id] ?? 0)),
    0
  );
}

export function shareFor(shares: Share[], personId: string): Money {
  return shares.find((share) => share.personId === personId)?.amount ?? 0;
}
