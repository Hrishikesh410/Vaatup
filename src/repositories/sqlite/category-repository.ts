import type { Database } from '@/database';
import type { Category } from '@/types/category';

import { toBool } from './rows';
import type { CategoryRepository } from '../types';

interface CategoryRow {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
  is_builtin: number;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    sortOrder: row.sort_order,
    isBuiltin: toBool(row.is_builtin),
  };
}

/**
 * Categories are seeded by the initial migration and read-only in the UI for
 * now. They live in a table rather than a constant so a user-defined category
 * is an insert rather than a schema change.
 */
export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Category[]> {
    const rows = await this.db.query<CategoryRow>(
      `SELECT id, label, icon, sort_order, is_builtin FROM categories ORDER BY sort_order`
    );
    return rows.map(toCategory);
  }

  async getById(id: string): Promise<Category | null> {
    const row = await this.db.queryOne<CategoryRow>(
      `SELECT id, label, icon, sort_order, is_builtin FROM categories WHERE id = ?`,
      [id]
    );
    return row ? toCategory(row) : null;
  }
}
