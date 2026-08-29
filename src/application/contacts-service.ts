import * as Contacts from 'expo-contacts';

import { preferredNumber } from '@/utils/contacts';

/**
 * Picking someone out of the phone's address book.
 *
 * Wrapped here for the same reason the WhatsApp hand-off is: a screen should
 * not know which native module it is talking to, and the ways this can fail are
 * worth naming rather than leaving as a thrown error.
 *
 * The system picker runs outside VaatUp, so only the one contact the user taps
 * is ever read, and only their name and one number are carried back. Both land
 * in the form, where the user can correct them before anything is saved.
 */

export interface PickedContact {
  name: string;
  /** Absent when the contact has no number stored at all. */
  phone?: string;
}

export type ContactPickResult =
  | { ok: true; contact: PickedContact }
  | { ok: false; reason: 'cancelled' | 'denied' | 'unavailable' };

export async function pickContact(): Promise<ContactPickResult> {
  try {
    // Android needs the read permission before the picked contact's details can
    // be looked up. Asked at the moment of use rather than at launch, so the
    // prompt arrives with the reason for it on screen.
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'denied' };

    const contact = await Contacts.Contact.presentPicker();
    if (!contact) return { ok: false, reason: 'cancelled' };

    const [fullName, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);

    return {
      ok: true,
      contact: { name: fullName.trim(), phone: preferredNumber(phones) },
    };
  } catch {
    // A device with no address book app, or one that refuses the picker. Typing
    // the details still works, so this is a dead end rather than a failure.
    return { ok: false, reason: 'unavailable' };
  }
}
