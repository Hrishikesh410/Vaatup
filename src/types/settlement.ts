import type { ExpenseId } from './expense';
import type { GroupId } from './group';
import type { Money } from './money';
import type { ParticipantId } from './participant';

export type SettlementId = string;

/**
 * A payment between two people.
 *
 * A settlement is a financial event in its own right and never replaces or
 * deletes the expense that created the debt: the expense records what was
 * consumed, the settlement records that money moved.
 */
export interface Settlement {
  id: SettlementId;
  ownerUserId: string;
  groupId?: GroupId;
  /**
   * Set when this settlement came from marking one person's share paid on one
   * expense. Null for a standalone settle up that clears a running balance.
   */
  expenseId?: ExpenseId;
  fromParticipantId: ParticipantId;
  toParticipantId: ParticipantId;
  amount: Money;
  currencyCode: string;
  settledAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementInput {
  groupId?: GroupId;
  expenseId?: ExpenseId;
  fromParticipantId: ParticipantId;
  toParticipantId: ParticipantId;
  amount: Money;
  currencyCode?: string;
  settledAt?: string;
  notes?: string;
}
