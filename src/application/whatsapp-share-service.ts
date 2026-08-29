import { loadCollector } from '@/storage/collector';
import type { GroupId } from '@/types/group';
import type { ExpenseDetail } from '@/types/expense';
import type { Money } from '@/types/money';
import type { Participant, ParticipantId } from '@/types/participant';
import type { Person } from '@/types/person';
import { DEFAULT_CURRENCY } from '@/utils/currency';
import { shareSummary, shareText } from '@/utils/sharing';
import type { UpiCollector } from '@/utils/upi';
import {
  buildExpenseMessage,
  buildPersonalMessage,
  buildSettlementConfirmation,
  buildSettlementMessage,
  openWhatsApp,
  type ExpenseMessageContext,
  type OpenWhatsAppResult,
  type SplitMessageContext,
} from '@/utils/whatsapp';

import { settledParticipantIds } from './settlement-service';

/**
 * Sharing what someone owes — the thing VaatUp is actually for.
 *
 * Screens call this instead of composing messages or URLs, so the wording lives
 * in one place and every entry point (expense, balance, settle up) reads the
 * same. Nothing is ever sent automatically: WhatsApp opens with the message
 * pre-filled and the user presses send.
 */

async function activeUpiCollector(): Promise<UpiCollector | undefined> {
  const profile = await loadCollector();
  return profile?.enabled && profile.vpa ? profile : undefined;
}

function participantName(participants: Participant[], participantId: ParticipantId): string {
  return participants.find((participant) => participant.id === participantId)?.name ?? 'Someone';
}

/** Turns a stored expense into the message view model. */
async function expenseMessageContext(
  expense: ExpenseDetail,
  settled: ParticipantId[]
): Promise<ExpenseMessageContext> {
  return {
    description: expense.description,
    total: expense.totalAmount,
    groupName: expense.groupName,
    payerNames: expense.payers.map((payer) =>
      participantName(expense.participants, payer.participantId)
    ),
    shares: expense.splits.map((split) => ({
      name: participantName(expense.participants, split.personId),
      amount: split.amount,
      settled: settled.includes(split.personId),
    })),
    currency: DEFAULT_CURRENCY,
    collector: await activeUpiCollector(),
  };
}

export type ShareExpenseResult = OpenWhatsAppResult;

/** What the caller needs to offer "share another way" when WhatsApp fails. */
export interface BillShareOutcome {
  result: OpenWhatsAppResult;
  message: string;
}

/** The context the split flow has, before payment details are attached. */
export type BillShareContext = Omit<SplitMessageContext, 'collector'>;

/**
 * Sends one person their share straight from the split flow.
 *
 * The screen passes what it knows about the bill; the collector's UPI details
 * are attached here so no screen has to remember to do it.
 */
export async function shareBillWithPerson(
  context: BillShareContext,
  recipient: Person
): Promise<BillShareOutcome> {
  const message = buildPersonalMessage(
    { ...context, collector: await activeUpiCollector() },
    recipient
  );
  return {
    result: await openWhatsApp({ phone: recipient.phone, message }),
    message,
  };
}

/** The whole split as plain text, for the OS share sheet. */
export async function shareBillSummary(context: BillShareContext): Promise<void> {
  await shareSummary({ ...context, collector: await activeUpiCollector() });
}

/**
 * Opens WhatsApp with one person's share of an expense.
 *
 * Anyone already marked as settled is told they owe nothing rather than being
 * asked again, which is why the settlements are read before composing.
 */
export async function shareExpense(
  expense: ExpenseDetail,
  recipientId: ParticipantId
): Promise<ShareExpenseResult> {
  const recipient = expense.participants.find((participant) => participant.id === recipientId);
  if (!recipient) return { ok: false, reason: 'no-phone' };

  const settled = await settledParticipantIds(expense.id);
  const share = expense.splits.find((split) => split.personId === recipientId)?.amount ?? 0;
  const paidAlready = settled.includes(recipientId);
  // Someone who helped pay for the expense owes only the part of their share
  // they did not cover themselves.
  const contributed =
    expense.payers.find((payer) => payer.participantId === recipientId)?.amountPaid ?? 0;

  const message = buildExpenseMessage(await expenseMessageContext(expense, settled), {
    name: recipient.name,
    share,
    amountToPay: paidAlready ? 0 : Math.max(0, share - contributed),
  });

  return openWhatsApp({ phone: recipient.phone, message });
}

/** The same expense as a plain summary, for the OS share sheet. */
export async function shareExpenseSummary(expense: ExpenseDetail): Promise<void> {
  const settled = await settledParticipantIds(expense.id);
  const context = await expenseMessageContext(expense, settled);

  await shareText(
    buildExpenseMessage(context, {
      name: 'everyone',
      share: expense.totalAmount,
      amountToPay: 0,
    })
  );
}

export interface SettlementShareInput {
  /** The person who owes. */
  from: Participant;
  /** The person owed, usually the signed-in user. */
  to: Participant;
  amount: Money;
  groupId?: GroupId;
  groupName?: string;
}

/** Asks someone to settle an outstanding balance. */
export async function shareSettlementRequest(
  input: SettlementShareInput
): Promise<OpenWhatsAppResult> {
  const message = buildSettlementMessage({
    fromName: input.from.name,
    toName: input.to.name,
    amount: input.amount,
    groupName: input.groupName,
    currency: DEFAULT_CURRENCY,
    collector: await activeUpiCollector(),
  });

  return openWhatsApp({ phone: input.from.phone, message });
}

/** Confirms to the other person that a settlement has been recorded. */
export async function shareSettlementConfirmation(
  input: SettlementShareInput
): Promise<OpenWhatsAppResult> {
  const message = buildSettlementConfirmation({
    fromName: input.from.name,
    toName: input.to.name,
    amount: input.amount,
    groupName: input.groupName,
    currency: DEFAULT_CURRENCY,
  });

  return openWhatsApp({ phone: input.to.phone, message });
}
