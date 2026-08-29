import type { CategoryId } from './category';
import type { ExpensePayer, ExpenseSplit } from './expense';
import type { GroupId } from './group';
import type { Money } from './money';
import type { SplitType } from './split';

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';

/**
 * A template that produces expenses on a schedule.
 *
 * Nothing runs in the background: due templates are materialised when the app
 * opens. That keeps the current version free of scheduling infrastructure while
 * leaving the model ready for a job to do the same work server-side later.
 */
export interface RecurringExpense {
  id: string;
  ownerUserId: string;
  groupId?: GroupId;
  description: string;
  totalAmount: Money;
  currencyCode: string;
  categoryId: CategoryId;
  splitType: SplitType;
  frequency: RecurrenceFrequency;
  notes?: string;
  payers: ExpensePayer[];
  splits: Omit<ExpenseSplit, 'splitType'>[];
  nextDueAt: string;
  lastRunAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpenseInput {
  groupId?: GroupId;
  description: string;
  totalAmount: Money;
  currencyCode?: string;
  categoryId: CategoryId;
  splitType: SplitType;
  frequency: RecurrenceFrequency;
  notes?: string;
  payers: ExpensePayer[];
  splits: Omit<ExpenseSplit, 'splitType'>[];
  /** Defaults to one period from now. */
  nextDueAt?: string;
}
