import type { Money } from './money';
import type { PersonId } from './person';

/**
 * How an expense is divided.
 *
 * `exact` was called `custom` while VaatUp only split restaurant bills. It
 * is the same behaviour — the user types each person's amount — renamed so the
 * app, the database and the UI all use one word for it.
 */
export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares';

export const SPLIT_TYPES: SplitType[] = ['equal', 'exact', 'percentage', 'shares'];

export interface Share {
  personId: PersonId;
  amount: Money;
  /**
   * What the user typed for this person: paise for `exact`, percent for
   * `percentage`, share count for `shares`, 1 for `equal`. Persisted next to
   * the money so the split can be reopened exactly as it was configured.
   */
  inputValue: number;
}

export interface SplitResult {
  splitType: SplitType;
  shares: Share[];
}

/** Percentages keyed by person, expressed as 0-100 (not fractions). */
export type PercentageMap = Record<PersonId, number>;

/** Manually entered amounts keyed by person, in minor units. */
export type AmountMap = Record<PersonId, Money>;

/** Share counts keyed by person, e.g. 2 shares for someone with a partner. */
export type ShareCountMap = Record<PersonId, number>;
