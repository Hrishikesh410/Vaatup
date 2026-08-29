import type { Currency, Money } from '@/types/money';

import { DEFAULT_CURRENCY, formatMoney, toMajorUnits } from './currency';

/**
 * Builds UPI collect details: a payment address the payer can use in any UPI
 * app, and the `upi://pay` URI behind the QR code.
 *
 * VaatUp never moves money. It composes a request that names the collector
 * and the exact amount; the payer's own bank app does everything else. Nothing
 * here talks to a network or a native module, so it is all unit tested.
 */

/** UPI is an Indian rail and its URI is defined for rupees only. */
export function supportsUpi(currency: Currency = DEFAULT_CURRENCY): boolean {
  return currency.code === 'INR';
}

/**
 * A virtual payment address, e.g. `9876543210@ybl` or `asha@okhdfcbank`.
 * NPCI allows a long local part; the handle is alphabetic with an optional
 * digit tail, which covers every PSP handle in circulation.
 */
const VPA_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,254}[a-zA-Z0-9])?@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

export function normalizeVpa(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidVpa(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeVpa(value);
  if (normalized.includes('..')) return false;
  return VPA_PATTERN.test(normalized);
}

/**
 * UPI apps display the payee name, and some PSPs reject punctuation in it, so
 * it is reduced to plain words before it goes on the wire.
 */
export function sanitizePayeeName(name: string): string {
  const cleaned = name
    // `\p{M}` keeps combining marks: without it, Indic vowel signs are stripped
    // and "आशा" comes out as "आश".
    .replace(/[^\p{L}\p{N}\p{M} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 50);
}

/** Transaction notes are capped by the spec; keep them short and recognisable. */
export function upiNote(billName: string): string {
  const trimmed = sanitizePayeeName(billName);
  return trimmed === '' ? 'Bill split' : trimmed.slice(0, 40);
}

export interface UpiCollector {
  /** The collector's own VPA. Never a payer's, and never sent anywhere. */
  vpa: string;
  /** Shown to the payer inside their UPI app. */
  name: string;
}

export interface UpiRequest {
  collector: UpiCollector;
  amount: Money;
  note?: string;
  currency?: Currency;
}

/**
 * `upi://pay?...` — the standard deep link every Indian payment app registers.
 * Amounts go over as plain decimals (`902.00`), never grouped or symbol-prefixed.
 */
export function buildUpiUri(request: UpiRequest): string {
  const currency = request.currency ?? DEFAULT_CURRENCY;
  const amount = toMajorUnits(request.amount, currency).toFixed(currency.minorUnitDigits);

  const params: [string, string][] = [
    ['pa', normalizeVpa(request.collector.vpa)],
    ['pn', sanitizePayeeName(request.collector.name)],
    ['am', amount],
    ['cu', currency.code],
  ];

  const note = request.note ? upiNote(request.note) : '';
  if (note !== '') params.push(['tn', note]);

  const query = params
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `upi://pay?${query}`;
}

/**
 * The line added to a WhatsApp message. Deliberately plain text: chat clients
 * do not reliably make a `upi://` link tappable, but a VPA is always something
 * the payer can copy into their own app — and the QR covers the tap case.
 */
export function upiCollectLine(
  collector: UpiCollector,
  amount: Money,
  currency: Currency = DEFAULT_CURRENCY
): string {
  return `💸 Pay ${formatMoney(amount, currency)} to ${normalizeVpa(collector.vpa)} (any UPI app)`;
}
