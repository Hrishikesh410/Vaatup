/**
 * Choosing which of a contact's numbers to put in the form.
 *
 * A saved contact often has several — a landline, a work desk, an old SIM — and
 * only one of them can be prefilled. The rule is kept here, away from the
 * native module, because it is the part worth testing.
 */

import { isValidPhoneNumber } from '@/utils/phone';

/** The shape this rule needs from a contact, whichever address book it came from. */
export interface ContactPhone {
  number?: string;
  label?: string;
}

/** What the platforms call a number that can receive a WhatsApp message. */
const MOBILE_LABELS = ['mobile', 'iphone', 'cell', 'main'];

function isMobile(label: string | undefined): boolean {
  return label !== undefined && MOBILE_LABELS.includes(label.trim().toLowerCase());
}

/**
 * A mobile number VaatUp can message, failing that any number it can message,
 * failing that the first one there is.
 *
 * The last case looks odd but is deliberate: showing an unusable number in the
 * field, where the existing validation flags it, tells the user which digits to
 * correct. Silently leaving the field empty does not.
 */
export function preferredNumber(phones: readonly ContactPhone[]): string | undefined {
  const numbers = phones
    .map((phone) => ({ number: (phone.number ?? '').trim(), label: phone.label }))
    .filter((phone) => phone.number !== '');

  const usable = numbers.filter((phone) => isValidPhoneNumber(phone.number));

  return (
    usable.find((phone) => isMobile(phone.label))?.number ?? usable[0]?.number ?? numbers[0]?.number
  );
}
