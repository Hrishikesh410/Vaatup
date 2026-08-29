import { Share } from 'react-native';

import { DEFAULT_CURRENCY, formatMoney } from './currency';
import { paidStatus } from './paid';
import { normalizeVpa, supportsUpi } from './upi';
import { billTitle, personLine, type SplitMessageContext } from './whatsapp';

/**
 * Plain-text summary for the OS share sheet, so the split can go out over
 * WhatsApp groups, Telegram, SMS, email — anything the device supports.
 */
export function buildShareSummary(context: SplitMessageContext): string {
  const currency = context.currency ?? DEFAULT_CURRENCY;
  const money = (amount: number) => formatMoney(amount, currency);
  const { totals, people, shares } = context;

  const lines: string[] = [billTitle(context.billName), '', `Total: ${money(totals.total)}`];

  if (totals.tip > 0 || totals.tax > 0) {
    const parts = [`Bill ${money(totals.base)}`];
    if (totals.tip > 0) parts.push(`Tip ${money(totals.tip)}`);
    if (totals.tax > 0) parts.push(`Tax ${money(totals.tax)}`);
    lines.push(`(${parts.join(' + ')})`);
  }

  lines.push('');
  for (const person of people) {
    lines.push(personLine(context, person));
  }

  // One address for the group: unlike the per-person message, a shared summary
  // has no single amount to ask for.
  if (context.collector && supportsUpi(currency)) {
    lines.push('', `Pay your share to ${normalizeVpa(context.collector.vpa)} (any UPI app)`);
  }

  const status = paidStatus(people, shares, context.paid ?? []);
  if (status.paidCount > 0) {
    lines.push(
      '',
      status.settled
        ? 'Everyone has paid.'
        : `Still to collect: ${money(status.outstanding)} from ${status.peopleCount - status.paidCount} of ${status.peopleCount}.`
    );
  }

  return lines.join('\n');
}

export async function shareText(message: string): Promise<void> {
  await Share.share({ message });
}

export async function shareSummary(context: SplitMessageContext): Promise<void> {
  await shareText(buildShareSummary(context));
}
