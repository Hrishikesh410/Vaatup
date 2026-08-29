import { getDatabase } from '@/database';

import { LocalAuthRepository } from './local-auth-repository';
import { SqliteCategoryRepository } from './sqlite/category-repository';
import { SqliteCommentRepository } from './sqlite/comment-repository';
import { SqliteExpenseRepository } from './sqlite/expense-repository';
import { SqliteGroupRepository } from './sqlite/group-repository';
import { SqliteParticipantRepository } from './sqlite/participant-repository';
import { SqliteRecurringExpenseRepository } from './sqlite/recurring-expense-repository';
import { SqliteSettlementRepository } from './sqlite/settlement-repository';
import type {
  AuthRepository,
  CategoryRepository,
  CommentRepository,
  ExpenseRepository,
  GroupRepository,
  ParticipantRepository,
  RecurringExpenseRepository,
  SettlementRepository,
} from './types';

export type * from './types';

/**
 * Where infrastructure is chosen.
 *
 * This is the only module that knows which implementations back the repository
 * interfaces. Pointing VaatUp at a backend later means adding API-backed
 * classes and switching them in here — services, hooks and screens do not
 * change, because none of them import a concrete repository.
 */
export type DataMode = 'local' | 'api';

export const DATA_MODE: DataMode = 'local';

export interface Repositories {
  auth: AuthRepository;
  participants: ParticipantRepository;
  groups: GroupRepository;
  expenses: ExpenseRepository;
  settlements: SettlementRepository;
  comments: CommentRepository;
  categories: CategoryRepository;
  recurring: RecurringExpenseRepository;
}

let repositories: Promise<Repositories> | null = null;

export function getRepositories(): Promise<Repositories> {
  repositories ??= (async () => {
    const db = await getDatabase();
    return {
      auth: new LocalAuthRepository(db),
      participants: new SqliteParticipantRepository(db),
      groups: new SqliteGroupRepository(db),
      expenses: new SqliteExpenseRepository(db),
      settlements: new SqliteSettlementRepository(db),
      comments: new SqliteCommentRepository(db),
      categories: new SqliteCategoryRepository(db),
      recurring: new SqliteRecurringExpenseRepository(db),
    };
  })();
  return repositories;
}
