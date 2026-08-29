import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteExpense } from '@/application/expense-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { ChipGroup, type ChipOption } from '@/components/chip-group';
import { ExpenseRow } from '@/components/expense-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCategories, useExpenses, useGroups } from '@/hooks/use-data';
import { useBillDraft } from '@/state/bill-draft';
import { useRefresh } from '@/state/refresh';
import { useSession } from '@/state/session';
import { spacing } from '@/theme/theme';
import type { Expense } from '@/types/expense';
import { formatMoney } from '@/utils/currency';
import { formatRelativeDay } from '@/utils/date';
import { tapWarning } from '@/utils/haptics';

/** Windows people actually think in, rather than a date picker. */
type DateWindow = 'all' | 'week' | 'month';

const DATE_WINDOWS: ChipOption<DateWindow>[] = [
  { value: 'all', label: 'All time' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
];

function windowStart(dateWindow: DateWindow): string | undefined {
  if (dateWindow === 'all') return undefined;
  const days = dateWindow === 'week' ? 7 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return start.toISOString();
}

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { self } = useSession();
  const { refresh } = useRefresh();
  const { startNewBill } = useBillDraft();

  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState<string>();
  const [categoryId, setCategoryId] = useState<string>();
  const [dateWindow, setDateWindow] = useState<DateWindow>('all');

  const groups = useGroups();
  const categories = useCategories();
  const expenses = useExpenses({
    search: search.trim() === '' ? undefined : search.trim(),
    groupId,
    categoryId,
    from: windowStart(dateWindow),
  });

  const groupOptions: ChipOption<string>[] = [
    { value: '', label: 'Any group' },
    ...groups.data.map((group) => ({ value: group.id, label: group.name })),
  ];

  const categoryOptions: ChipOption<string>[] = [
    { value: '', label: 'Any category' },
    ...categories.data.map((category) => ({
      value: category.id,
      label: category.label,
    })),
  ];

  const iconFor = (expense: Expense) =>
    categories.data.find((category) => category.id === expense.categoryId)?.icon;

  const groupNameFor = (expense: Expense) =>
    groups.data.find((group) => group.id === expense.groupId)?.name;

  /** History reads as a diary, so it is broken up by the day money was spent. */
  const days = useMemo(() => {
    const byDay = new Map<string, Expense[]>();
    for (const expense of expenses.data) {
      const label = formatRelativeDay(expense.spentAt);
      const forDay = byDay.get(label) ?? [];
      forDay.push(expense);
      byDay.set(label, forDay);
    }
    return [...byDay.entries()];
  }, [expenses.data]);

  const total = expenses.data.reduce((sum, expense) => sum + expense.totalAmount, 0);

  const confirmDelete = (expense: Expense) => {
    tapWarning();
    Alert.alert(expense.description, 'Remove this expense from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(expense.id);
          refresh();
        },
      },
    ]);
  };

  const filtered = search.trim() !== '' || groupId || categoryId || dateWindow !== 'all';

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + spacing.xl }}
      footer={
        <PrimaryButton
          label="Add an expense"
          icon="+"
          onPress={() => {
            startNewBill();
            router.push('/bill/create');
          }}
        />
      }
    >
      <AppText variant="heading">Expenses</AppText>

      <TextField
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Dinner, cab, hotel…"
        autoCapitalize="none"
        returnKeyType="search"
      />

      <ChipGroup
        options={DATE_WINDOWS}
        value={dateWindow}
        onChange={setDateWindow}
        accessibilityLabel="Filter by date"
      />

      {groups.data.length > 0 ? (
        <ChipGroup
          options={groupOptions}
          value={groupId ?? ''}
          onChange={(next) => setGroupId(next === '' ? undefined : next)}
          accessibilityLabel="Filter by group"
        />
      ) : null}

      <ChipGroup
        options={categoryOptions}
        value={categoryId ?? ''}
        onChange={(next) => setCategoryId(next === '' ? undefined : next)}
        accessibilityLabel="Filter by category"
      />

      {expenses.data.length === 0 ? (
        expenses.loading ? null : (
          <Card>
            <AppText variant="body" muted>
              {filtered
                ? 'No expenses match those filters.'
                : 'Nothing here yet. Your expenses will build up as you add them.'}
            </AppText>
          </Card>
        )
      ) : (
        <>
          <AppText variant="caption" muted>
            {expenses.data.length} {expenses.data.length === 1 ? 'expense' : 'expenses'} ·{' '}
            {formatMoney(total)}
          </AppText>

          {days.map(([day, forDay]) => (
            <View key={day} style={styles.day}>
              <SectionLabel>{day}</SectionLabel>
              {forDay.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  selfId={self?.id}
                  categoryIcon={iconFor(expense)}
                  groupName={groupNameFor(expense)}
                  onPress={() =>
                    router.push({
                      pathname: '/expense/[id]',
                      params: { id: expense.id },
                    })
                  }
                  onLongPress={() => confirmDelete(expense)}
                />
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: {
    gap: spacing.sm,
  },
});
