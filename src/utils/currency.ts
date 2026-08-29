import type { Currency, Money } from '@/types/money';

export const INR: Currency = {
  code: 'INR',
  symbol: '₹',
  minorUnitDigits: 2,
  locale: 'en-IN',
};

/**
 * V1 ships INR only. Everything downstream takes a `Currency`, so adding a
 * currency later means adding an entry here rather than editing screens.
 */
export const DEFAULT_CURRENCY = INR;

function minorUnitFactor(currency: Currency): number {
  return 10 ** currency.minorUnitDigits;
}

/** Converts major units (rupees) to minor units (paise), rounding half away from zero. */
export function toMinorUnits(major: number, currency: Currency = DEFAULT_CURRENCY): Money {
  const scaled = major * minorUnitFactor(currency);
  return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
}

export function toMajorUnits(minor: Money, currency: Currency = DEFAULT_CURRENCY): number {
  return minor / minorUnitFactor(currency);
}

function groupDigits(digits: string, locale: string): string {
  // Indian grouping is 3 digits then 2s (12,34,567); most others are pure 3s.
  if (!locale.endsWith('-IN')) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

export interface FormatMoneyOptions {
  /** Force the decimal part even when the amount is a whole rupee. */
  alwaysShowDecimals?: boolean;
  /** Drop the currency symbol, e.g. when it is already shown next to the field. */
  hideSymbol?: boolean;
}

/**
 * Formats money for display: `₹2,460` when whole, `₹333.34` when not.
 * Hiding trailing `.00` keeps the common case visually quiet.
 */
export function formatMoney(
  minor: Money,
  currency: Currency = DEFAULT_CURRENCY,
  options: FormatMoneyOptions = {}
): string {
  const factor = minorUnitFactor(currency);
  const rounded = Math.round(minor);
  const negative = rounded < 0;
  const absolute = Math.abs(rounded);

  const wholePart = Math.trunc(absolute / factor);
  const fractionPart = absolute % factor;
  const showDecimals =
    currency.minorUnitDigits > 0 && (options.alwaysShowDecimals || fractionPart !== 0);

  let text = groupDigits(String(wholePart), currency.locale);
  if (showDecimals) {
    text += `.${String(fractionPart).padStart(currency.minorUnitDigits, '0')}`;
  }
  if (!options.hideSymbol) text = `${currency.symbol}${text}`;
  return negative ? `-${text}` : text;
}

/**
 * Parses user input into minor units. Returns `null` for anything that is not a
 * non-negative amount, so callers can decide what message to show.
 */
export function parseMoney(input: string, currency: Currency = DEFAULT_CURRENCY): Money | null {
  const cleaned = input.replace(new RegExp(`[\\s,${currency.symbol}]`, 'g'), '');
  if (cleaned === '' || !/^\d*(\.\d*)?$/.test(cleaned)) return null;

  const [whole = '', fraction = ''] = cleaned.split('.');
  if (whole === '' && fraction === '') return null;

  const digits = currency.minorUnitDigits;
  const kept = fraction.slice(0, digits).padEnd(digits, '0');
  const nextDigit = fraction.charCodeAt(digits) - 48;
  const roundUp = nextDigit >= 5 && nextDigit <= 9;

  const minor = Number(`${whole || '0'}${kept}`) + (roundUp ? 1 : 0);
  return Number.isFinite(minor) ? minor : null;
}

/** Renders minor units into an editable string without the symbol or grouping. */
export function toInputValue(minor: Money, currency: Currency = DEFAULT_CURRENCY): string {
  if (minor === 0) return '';
  return formatMoney(minor, currency, { hideSymbol: true }).replace(/,/g, '');
}
