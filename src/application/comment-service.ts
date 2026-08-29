import { DatabaseError } from '@/database';
import { StorageError, isDomainError } from '@/domain/errors';
import { getRepositories } from '@/repositories';
import type { ExpenseComment } from '@/types/comment';
import type { ExpenseId } from '@/types/expense';
import type { ParticipantId } from '@/types/participant';

/**
 * Comments on an expense — "I didn't have the dessert" — kept as their own
 * records so a disagreement can be discussed without editing the expense.
 */

async function asApplicationError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isDomainError(error)) throw error;
    if (error instanceof DatabaseError)
      throw new StorageError('Could not save that comment.', error);
    throw error;
  }
}

export async function listComments(expenseId: ExpenseId): Promise<ExpenseComment[]> {
  const { comments } = await getRepositories();
  return asApplicationError(() => comments.list(expenseId));
}

export async function addComment(
  expenseId: ExpenseId,
  authorParticipantId: ParticipantId,
  comment: string
): Promise<ExpenseComment | null> {
  const trimmed = comment.trim();
  if (trimmed === '') return null;

  const { comments } = await getRepositories();
  return asApplicationError(() => comments.create(expenseId, authorParticipantId, trimmed));
}

export async function removeComment(id: string): Promise<void> {
  const { comments } = await getRepositories();
  await asApplicationError(() => comments.remove(id));
}
