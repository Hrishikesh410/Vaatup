/**
 * Phone normalization for WhatsApp deep links.
 *
 * WhatsApp needs a full international number with no punctuation and no leading
 * `+`. Users, however, type local numbers. India is the default country in V1,
 * but the rules live in a registry so another country is a data change, not a
 * code change.
 */

export interface CountryDialing {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** International calling code without `+`. */
  callingCode: string;
  /** Valid lengths of a subscriber number, excluding the calling code. */
  nationalLengths: number[];
  /** Trunk prefix stripped before dialling internationally, e.g. '0' in India. */
  trunkPrefix?: string;
}

export const COUNTRIES: Record<string, CountryDialing> = {
  IN: {
    code: 'IN',
    name: 'India',
    callingCode: '91',
    nationalLengths: [10],
    trunkPrefix: '0',
  },
};

export const DEFAULT_COUNTRY = 'IN';

/** E.164 allows at most 15 digits including the calling code. */
const MAX_E164_DIGITS = 15;
const MIN_E164_DIGITS = 8;

export type PhoneError = 'empty' | 'invalid';

export type NormalizedPhone =
  | {
      ok: true;
      /** E.164 digits without the leading `+`. */ digits: string;
      e164: string;
    }
  | { ok: false; reason: PhoneError };

function acceptIfLengthIsPlausible(digits: string): NormalizedPhone {
  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, digits, e164: `+${digits}` };
}

export function normalizePhoneNumber(
  raw: string | undefined,
  countryCode: string = DEFAULT_COUNTRY
): NormalizedPhone {
  const input = (raw ?? '').trim();
  if (input === '') return { ok: false, reason: 'empty' };

  const hasPlus = input.startsWith('+');
  let digits = input.replace(/\D/g, '');
  if (digits === '') return { ok: false, reason: 'empty' };

  // Already international: '+91…' or the '00' exit code.
  if (hasPlus) return acceptIfLengthIsPlausible(digits);
  if (digits.startsWith('00')) return acceptIfLengthIsPlausible(digits.slice(2));

  const country = COUNTRIES[countryCode] ?? COUNTRIES[DEFAULT_COUNTRY];
  const { callingCode, nationalLengths, trunkPrefix } = country;

  if (trunkPrefix && digits.startsWith(trunkPrefix)) {
    const withoutTrunk = digits.slice(trunkPrefix.length);
    if (nationalLengths.includes(withoutTrunk.length)) digits = withoutTrunk;
  }

  if (nationalLengths.includes(digits.length))
    return acceptIfLengthIsPlausible(`${callingCode}${digits}`);

  if (digits.startsWith(callingCode)) {
    const national = digits.slice(callingCode.length);
    if (nationalLengths.includes(national.length)) return acceptIfLengthIsPlausible(digits);
  }

  return { ok: false, reason: 'invalid' };
}

export function isValidPhoneNumber(raw: string | undefined, countryCode?: string): boolean {
  return normalizePhoneNumber(raw, countryCode).ok;
}
