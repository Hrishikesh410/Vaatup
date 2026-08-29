import type { Database } from '@/database';
import { StorageError } from '@/domain/errors';
import type { ExpenseComment } from '@/types/comment';
import type { ExpenseId } from '@/types/expense';
import type { ParticipantId } from '@/types/participant';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';

import type { CommentRepository } from '../types';

interface CommentRow {
  id: string;
  expense_id: string;
  author_participant_id: string;
  author_name: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

function toComment(row: CommentRow): ExpenseComment {
  return {
    id: row.id,
    expenseId: row.expense_id,
    authorParticipantId: row.author_participant_id,
    authorName: row.author_name,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT c.id, c.expense_id, c.author_participant_id, p.name AS author_name,
                       c.comment, c.created_at, c.updated_at
                  FROM expense_comments c
                  JOIN participants p ON p.id = c.author_participant_id`;

export class SqliteCommentRepository implements CommentRepository {
  constructor(private readonly db: Database) {}

  async list(expenseId: ExpenseId): Promise<ExpenseComment[]> {
    const rows = await this.db.query<CommentRow>(
      `${SELECT} WHERE c.expense_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at`,
      [expenseId]
    );
    return rows.map(toComment);
  }

  async create(
    expenseId: ExpenseId,
    authorParticipantId: ParticipantId,
    comment: string
  ): Promise<ExpenseComment> {
    const id = createId('comment');
    const timestamp = nowIso();

    await this.db.execute(
      `INSERT INTO expense_comments (id, expense_id, author_participant_id, comment,
                                     created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      [id, expenseId, authorParticipantId, comment.trim(), timestamp, timestamp]
    );

    const row = await this.db.queryOne<CommentRow>(`${SELECT} WHERE c.id = ?`, [id]);
    if (!row) throw new StorageError('Could not save that comment.');
    return toComment(row);
  }

  async remove(id: string): Promise<void> {
    const timestamp = nowIso();
    await this.db.execute(
      `UPDATE expense_comments SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, id]
    );
  }
}
