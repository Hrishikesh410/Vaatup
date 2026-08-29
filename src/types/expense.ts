import type { CategoryId } from './category';
import type { GroupId } from './group';
import type { Money } from './money';
import type { Participant, ParticipantId } from './participant';
import type { Share, SplitType } from './split';

export type ExpenseId = string;

export interface ExpensePayer {
  participantId: ParticipantId;
  amountPaid: Money;
}

export interface ExpenseSplit extends Share {
  splitType: SplitType;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: Money;
  position: number;
  /** Who is on the hook for this line. Empty means "everyone on the expense". */
  assignedTo: ParticipantId[];
}

/**
 * A persisted expense.
 *
 * `totalAmount` is authoritative and always equals `baseAmount + tipAmount +
 * taxAmount`; it is also what the payers and the splits must each add up to.
 * The tip is stored as settled money rather than as a percentage, so reopening
 * an expense shows the tip as an amount even if it was entered as a percentage.
 */
export interface Expense {
  id: ExpenseId;
  ownerUserId: string;
  groupId?: GroupId;
  description: string;
  totalAmount: Money;
  baseAmount: Money;
  tipAmount: Money;
  taxAmount: Money;
  currencyCode: string;
  splitType: SplitType;
  categoryId: CategoryId;
  notes?: string;
  receiptUri?: string;
  /** When the money was actually spent, which is what history sorts by. */
  spentAt: string;
  createdAt: string;
  updatedAt: string;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  items: ExpenseItem[];
}

/** An expense with its people resolved, ready to render. */
export interface ExpenseDetail extends Expense {
  participants: Participant[];
  groupName?: string;
  categoryLabel: string;
  categoryIcon: string;
}

/** What a service needs to create or replace an expense. */
export interface ExpenseInput {
  id?: ExpenseId;
  groupId?: GroupId;
  description: string;
  baseAmount: Money;
  tipAmount: Money;
  taxAmount: Money;
  currencyCode: string;
  splitType: SplitType;
  categoryId: CategoryId;
  notes?: string;
  receiptUri?: string;
  spentAt: string;
  payers: ExpensePayer[];
  splits: Omit<ExpenseSplit, 'splitType'>[];
  items?: Omit<ExpenseItem, 'id'>[];
}

export interface ExpenseFilters {
  /** Matched against description and notes, case-insensitively. */
  search?: string;
  groupId?: GroupId;
  categoryId?: CategoryId;
  /** Expenses this person paid for or owes on. */
  participantId?: ParticipantId;
  /** Inclusive ISO date bounds on `spentAt`. */
  from?: string;
  to?: string;
  limit?: number;
}
