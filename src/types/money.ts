/**
 * All money in VaatUp is an integer number of minor units (paise for INR).
 *
 * Storing money as integers is what keeps the split arithmetic exact: a bill of
 * 1000 split three ways must add back up to exactly 1000, which is impossible to
 * guarantee with floating point rupees.
 */
export type Money = number;

export interface Currency {
  code: string;
  symbol: string;
  /** Digits after the decimal separator, i.e. 2 for INR/USD, 0 for JPY. */
  minorUnitDigits: number;
  /** Used for digit grouping, e.g. 'en-IN' groups as 12,34,567. */
  locale: string;
}
