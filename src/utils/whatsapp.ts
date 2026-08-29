import * as Linking from 'expo-linking';

import type { BillTotals } from '@/types/bill';
import type { Currency } from '@/types/money';
import type { Person, PersonId } from '@/types/person';
import type { Share } from '@/types/split';

import { shareFor } from './calculations';
import { DEFAULT_CURRENCY, formatMoney } from './currency';
import { isPaid } from './paid';
import { normalizePhoneNumber } from './phone';
import { supportsUpi, upiCollectLine, type UpiCollector } from './upi';

/**
 * VaatUp never sends anything on the user's behalf. This module only
 * *composes* a message and *opens* WhatsApp with it pre-filled; the user reads
 * it and presses send inside WhatsApp.
 *
 * Message and URL building are pure and exported separately from `openWhatsApp`
 * so they can be tested without any native module, and so an official WhatsApp
 * Business transport could be added later behind the same builders.
 */

export interface SplitMessageContext {
  billName: string;
  totals: BillTotals;
  people: Person[];
  shares: Share[];
  /** Ids of people who have settled up, so the message does not ask them again. */
  paid?: PersonId[];
  currency?: Currency;
  /** The user's own UPI details, when they have chosen to ask for money that way. */
  collector?: UpiCollector;
}

/** Display title for a bill the user never named. */
export function billTitle(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? 'Bill' : trimmed;
}

/** `Rahul: ₹492` or `Rahul: ₹492 (paid)` — the roster line shared everywhere. */
export function personLine(context: SplitMessageContext, person: Person): string {
  const currency = context.currency ?? DEFAULT_CURRENCY;
  const amount = formatMoney(shareFor(context.shares, person.id), currency);
  const settled = isPaid(context.paid ?? [], person.id);
  return `${person.name.trim()}: ${amount}${settled ? ' (paid)' : ''}`;
}

/** Builds the per-person message. The recipient's own share is made unmissable. */
export function buildPersonalMessage(context: SplitMessageContext, recipient: Person): string {
  const currency = context.currency ?? DEFAULT_CURRENCY;
  const { totals, people, shares } = context;
  const money = (amount: number) => formatMoney(amount, currency);

  const subject = context.billName.trim() === '' ? 'our bill' : context.billName.trim();

  const lines: string[] = [
    `Hey ${recipient.name.trim()} 👋`,
    '',
    `Here's the split for ${subject}:`,
    '',
    `Total bill: ${money(totals.total)}`,
  ];

  if (totals.tip > 0 || totals.tax > 0) {
    const parts = [`Bill ${money(totals.base)}`];
    if (totals.tip > 0) parts.push(`Tip ${money(totals.tip)}`);
    if (totals.tax > 0) parts.push(`Tax ${money(totals.tax)}`);
    lines.push(`(${parts.join(' + ')})`);
  }

  const recipientPaid = isPaid(context.paid ?? [], recipient.id);

  lines.push(
    `People: ${people.length}`,
    '',
    `💰 Your share: ${money(shareFor(shares, recipient.id))}${recipientPaid ? ' (received — thanks!)' : ''}`,
    '',
    'Split:'
  );

  for (const person of people) {
    lines.push(personLine(context, person));
  }

  // Nobody who has already paid should be handed payment instructions.
  if (context.collector && !recipientPaid && supportsUpi(currency)) {
    lines.push('', upiCollectLine(context.collector, shareFor(shares, recipient.id), currency));
  }

  lines.push('', recipientPaid ? 'All settled!' : 'Thanks!', '— VaatUp');
  return lines.join('\n');
}

/**
 * A stored expense, reduced to what a message needs. Deliberately not the
 * database type: the wording should not have to change when the schema does.
 */
export interface ExpenseMessageContext {
  description: string;
  total: number;
  /** Names of everyone who paid, in the order shown on the expense. */
  payerNames: string[];
  groupName?: string;
  /** Everyone's share, for the roster at the bottom of the message. */
  shares: { name: string; amount: number; settled: boolean }[];
  currency?: Currency;
  collector?: UpiCollector;
}

export interface ExpenseRecipient {
  name: string;
  share: number;
  /** What is left after anything already settled. */
  amountToPay: number;
}

/**
 * The message for one person's share of a stored expense.
 *
 * `Your share` and `Amount to pay` are both shown because they differ once
 * something has been settled, and the recipient needs to see why.
 */
export function buildExpenseMessage(
  context: ExpenseMessageContext,
  recipient: ExpenseRecipient
): string {
  const currency = context.currency ?? DEFAULT_CURRENCY;
  const money = (amount: number) => formatMoney(amount, currency);

  const lines: string[] = [
    'VaatUp 💸',
    '',
    `${context.description.trim() || 'Expense'} — ${money(context.total)}`,
  ];

  if (context.groupName) lines.push(`Group: ${context.groupName}`);

  lines.push(
    '',
    `Paid by: ${context.payerNames.join(', ') || 'someone'}`,
    '',
    `Hi ${recipient.name.trim()} 👋`,
    `Your share: ${money(recipient.share)}`
  );

  if (recipient.amountToPay <= 0) {
    lines.push('Amount to pay: nothing — you are all settled. Thanks!');
  } else {
    lines.push(`Amount to pay: ${money(recipient.amountToPay)}`);
  }

  if (context.shares.length > 1) {
    lines.push('', 'Everyone:');
    for (const share of context.shares) {
      lines.push(`${share.name.trim()}: ${money(share.amount)}${share.settled ? ' (paid)' : ''}`);
    }
  }

  if (context.collector && recipient.amountToPay > 0 && supportsUpi(currency)) {
    lines.push('', upiCollectLine(context.collector, recipient.amountToPay, currency));
  }

  lines.push('', '— VaatUp');
  return lines.join('\n');
}

export interface SettlementMessageContext {
  /** The person being asked, i.e. the one who owes. */
  fromName: string;
  /** The person owed. */
  toName: string;
  amount: number;
  groupName?: string;
  currency?: Currency;
  collector?: UpiCollector;
}

/**
 * A nudge about an outstanding balance rather than a single expense. Used from
 * the balances and settle up screens.
 */
export function buildSettlementMessage(context: SettlementMessageContext): string {
  const currency = context.currency ?? DEFAULT_CURRENCY;
  const scope = context.groupName ? ` for ${context.groupName}` : '';

  const lines: string[] = [
    'VaatUp 💸',
    '',
    `Hi ${context.fromName.trim()} 👋`,
    '',
    `Balance so far: you owe ${context.toName.trim()} ${formatMoney(context.amount, currency)}${scope}.`,
    '',
    'No rush — settle whenever it suits you.',
  ];

  if (context.collector && supportsUpi(currency)) {
    lines.push('', upiCollectLine(context.collector, context.amount, currency));
  }

  lines.push('', '— VaatUp');
  return lines.join('\n');
}

/** The other direction: telling someone what they are owed has been sent. */
export function buildSettlementConfirmation(context: SettlementMessageContext): string {
  const currency = context.currency ?? DEFAULT_CURRENCY;
  const scope = context.groupName ? ` for ${context.groupName}` : '';

  return [
    'VaatUp 💸',
    '',
    `Hi ${context.toName.trim()} 👋`,
    '',
    `Settled: ${formatMoney(context.amount, currency)}${scope}.`,
    'Recorded in VaatUp, so we are square.',
    '',
    '— VaatUp',
  ].join('\n');
}

export interface WhatsAppLinks {
  /** Opens the installed app directly. */
  appUrl: string;
  /** Universal link; works in a browser or WhatsApp Web as a fallback. */
  webUrl: string;
}

export function buildWhatsAppLinks(digits: string, message: string): WhatsAppLinks {
  const text = encodeURIComponent(message);
  return {
    appUrl: `whatsapp://send?phone=${digits}&text=${text}`,
    webUrl: `https://wa.me/${digits}?text=${text}`,
  };
}

export type OpenWhatsAppFailure = 'no-phone' | 'invalid-phone' | 'not-installed' | 'failed';

export type OpenWhatsAppResult = { ok: true } | { ok: false; reason: OpenWhatsAppFailure };

export interface OpenWhatsAppOptions {
  phone: string | undefined;
  message: string;
  countryCode?: string;
}

/**
 * Opens WhatsApp with the message pre-filled, falling back to the wa.me
 * universal link when the app scheme is unavailable (e.g. web).
 */
export async function openWhatsApp(options: OpenWhatsAppOptions): Promise<OpenWhatsAppResult> {
  const phone = normalizePhoneNumber(options.phone, options.countryCode);
  if (!phone.ok) {
    return {
      ok: false,
      reason: phone.reason === 'empty' ? 'no-phone' : 'invalid-phone',
    };
  }

  const links = buildWhatsAppLinks(phone.digits, options.message);

  try {
    if (await Linking.canOpenURL(links.appUrl)) {
      await Linking.openURL(links.appUrl);
      return { ok: true };
    }
  } catch {
    // canOpenURL can reject (e.g. undeclared scheme); fall through to the web link.
  }

  try {
    await Linking.openURL(links.webUrl);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'not-installed' };
  }
}
