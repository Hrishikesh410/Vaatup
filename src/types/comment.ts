import type { ExpenseId } from './expense';
import type { ParticipantId } from './participant';

export interface ExpenseComment {
  id: string;
  expenseId: ExpenseId;
  authorParticipantId: ParticipantId;
  /** Denormalised for rendering; the participant row stays the source of truth. */
  authorName: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}
