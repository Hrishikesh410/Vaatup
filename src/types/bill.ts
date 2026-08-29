import type { CategoryId } from './category';
import type { ExpenseId } from './expense';
import type { GroupId } from './group';
import type { Money } from './money';
import type { Person, PersonId } from './person';
import type { AmountMap, PercentageMap, ShareCountMap, SplitType } from './split';

export type Tip =
  { kind: 'none' } | { kind: 'percent'; percent: number } | { kind: 'amount'; amount: Money };

export interface BillTotals {
  /** The amount printed on the bill, before anything VaatUp adds. */
  base: Money;
  tip: Money;
  tax: Money;
  total: Money;
}

/** One line of an itemised bill, before it is saved. */
export interface DraftItem {
  name: string;
  amount: Money;
  /** Empty means the line is shared by everyone on the expense. */
  assignedTo: PersonId[];
}

/**
 * The expense being built across the create → people → split → result flow.
 *
 * This is still the fast path VaatUp started with — type an amount, add
 * names, send — so the draft stays in memory and is only written to the
 * database when the split is finished. Everything a stored expense needs
 * (group, payers, category) has a sensible default, so the quick flow never
 * has to ask.
 */
export interface BillDraft {
  id: string;
  /** Set when editing an expense that already exists. */
  expenseId?: ExpenseId;
  name: string;
  base: Money;
  tip: Tip;
  tax: Money;
  people: Person[];
  splitType: SplitType;
  exactAmounts: AmountMap;
  percentages: PercentageMap;
  shareCounts: ShareCountMap;
  /**
   * Who paid. A single payer covers the whole total, so no amount is needed;
   * with several, the entered amounts must add up to it exactly.
   */
  payerIds: PersonId[];
  payments: AmountMap;
  groupId?: GroupId;
  categoryId: CategoryId;
  notes: string;
  receiptUri?: string;
  items: DraftItem[];
  /** Who has settled their share. */
  paid: PersonId[];
  /** When the money was spent; defaults to now and is editable. */
  spentAt: string;
  /**
   * Set when the bill is started and carried into history, so marking someone
   * paid later re-saves the bill without changing the date it was split on.
   */
  createdAt: string;
}
