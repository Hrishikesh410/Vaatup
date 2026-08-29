import {
  getBalanceOverview,
  getGroupBalances,
  getSettlementSuggestions,
  type BalanceOverview,
  type NamedBalance,
} from '@/application/balance-service';
import { listComments } from '@/application/comment-service';
import { getExpenseDetail, listCategories, listExpenses } from '@/application/expense-service';
import { listFriends, listGroups, listPeople } from '@/application/people-service';
import { listRecurring } from '@/application/recurring-service';
import { listSettlements, settledParticipantIds } from '@/application/settlement-service';
import { useSession } from '@/state/session';
import type { SettlementSuggestion } from '@/types/balance';
import type { Category } from '@/types/category';
import type { ExpenseComment } from '@/types/comment';
import type { Expense, ExpenseDetail, ExpenseFilters } from '@/types/expense';
import type { GroupWithMembers } from '@/types/group';
import type { Participant, ParticipantId } from '@/types/participant';
import type { RecurringExpense } from '@/types/recurring';
import type { Settlement } from '@/types/settlement';

import { useAsync, type AsyncState } from './use-async';

/**
 * One hook per thing a screen needs.
 *
 * These are the only place the UI touches the application layer for reads, so
 * no screen imports a repository or knows that any of this is stored in SQLite.
 */

const NO_PARTICIPANTS: Participant[] = [];
const NO_GROUPS: GroupWithMembers[] = [];
const NO_EXPENSES: Expense[] = [];
const NO_SETTLEMENTS: Settlement[] = [];
const NO_CATEGORIES: Category[] = [];
const NO_COMMENTS: ExpenseComment[] = [];
const NO_SUGGESTIONS: SettlementSuggestion[] = [];
const NO_BALANCES: NamedBalance[] = [];
const NO_IDS: ParticipantId[] = [];
const EMPTY_OVERVIEW: BalanceOverview = {
  owed: 0,
  owes: 0,
  net: 0,
  people: [],
};

function useUserId(): string {
  return useSession().user?.id ?? '';
}

export function useFriends(): AsyncState<Participant[]> {
  const userId = useUserId();
  return useAsync(
    () => (userId ? listFriends(userId) : Promise.resolve(NO_PARTICIPANTS)),
    `friends:${userId}`,
    NO_PARTICIPANTS
  );
}

/** Friends plus the user themselves, which is who an expense can involve. */
export function usePeople(): AsyncState<Participant[]> {
  const userId = useUserId();
  return useAsync(
    () => (userId ? listPeople(userId) : Promise.resolve(NO_PARTICIPANTS)),
    `people:${userId}`,
    NO_PARTICIPANTS
  );
}

export function useGroups(): AsyncState<GroupWithMembers[]> {
  const userId = useUserId();
  return useAsync(
    () => (userId ? listGroups(userId) : Promise.resolve(NO_GROUPS)),
    `groups:${userId}`,
    NO_GROUPS
  );
}

export function useExpenses(filters: ExpenseFilters = {}): AsyncState<Expense[]> {
  const userId = useUserId();
  const key = [
    'expenses',
    userId,
    filters.search ?? '',
    filters.groupId ?? '',
    filters.categoryId ?? '',
    filters.participantId ?? '',
    filters.from ?? '',
    filters.to ?? '',
    filters.limit ?? '',
  ].join(':');

  return useAsync(
    () => (userId ? listExpenses(userId, filters) : Promise.resolve(NO_EXPENSES)),
    key,
    NO_EXPENSES
  );
}

export function useExpenseDetail(id: string | undefined): AsyncState<ExpenseDetail | null> {
  return useAsync(
    () => (id ? getExpenseDetail(id) : Promise.resolve(null)),
    `expense:${id ?? ''}`,
    null
  );
}

export function useBalanceOverview(groupId?: string): AsyncState<BalanceOverview> {
  const userId = useUserId();
  return useAsync(
    () => (userId ? getBalanceOverview(userId, { groupId }) : Promise.resolve(EMPTY_OVERVIEW)),
    `overview:${userId}:${groupId ?? ''}`,
    EMPTY_OVERVIEW
  );
}

export function useGroupBalances(groupId: string | undefined): AsyncState<NamedBalance[]> {
  const userId = useUserId();
  return useAsync(
    () => (userId && groupId ? getGroupBalances(userId, groupId) : Promise.resolve(NO_BALANCES)),
    `groupBalances:${userId}:${groupId ?? ''}`,
    NO_BALANCES
  );
}

export function useSettlementSuggestions(groupId?: string): AsyncState<SettlementSuggestion[]> {
  const userId = useUserId();
  return useAsync(
    () =>
      userId ? getSettlementSuggestions(userId, { groupId }) : Promise.resolve(NO_SUGGESTIONS),
    `suggestions:${userId}:${groupId ?? ''}`,
    NO_SUGGESTIONS
  );
}

export function useSettlements(options: { groupId?: string; limit?: number } = {}) {
  const userId = useUserId();
  return useAsync(
    () => (userId ? listSettlements(userId, options) : Promise.resolve(NO_SETTLEMENTS)),
    `settlements:${userId}:${options.groupId ?? ''}:${options.limit ?? ''}`,
    NO_SETTLEMENTS
  );
}

export function useCategories(): AsyncState<Category[]> {
  return useAsync(() => listCategories(), 'categories', NO_CATEGORIES);
}

export function useComments(expenseId: string | undefined): AsyncState<ExpenseComment[]> {
  return useAsync(
    () => (expenseId ? listComments(expenseId) : Promise.resolve(NO_COMMENTS)),
    `comments:${expenseId ?? ''}`,
    NO_COMMENTS
  );
}

/** Who has been marked paid on one expense. */
export function useSettledIds(expenseId: string | undefined): AsyncState<ParticipantId[]> {
  return useAsync(
    () => (expenseId ? settledParticipantIds(expenseId) : Promise.resolve(NO_IDS)),
    `settled:${expenseId ?? ''}`,
    NO_IDS
  );
}

export function useRecurring(): AsyncState<RecurringExpense[]> {
  const userId = useUserId();
  return useAsync(
    () => (userId ? listRecurring(userId) : Promise.resolve([])),
    `recurring:${userId}`,
    []
  );
}
