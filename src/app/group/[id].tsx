import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { removeGroup } from '@/application/people-service';
import { AppText } from '@/components/app-text';
import { BalanceHeadline } from '@/components/balance-headline';
import { Card, SectionLabel } from '@/components/card';
import { ExpenseRow } from '@/components/expense-row';
import { GroupForm } from '@/components/group-form';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { useBalanceOverview, useExpenses, useGroupBalances, useGroups } from '@/hooks/use-data';
import { useBillDraft } from '@/state/bill-draft';
import { useRefresh } from '@/state/refresh';
import { useSession } from '@/state/session';
import { spacing, useTheme } from '@/theme/theme';
import { formatMoney } from '@/utils/currency';
import { tapWarning } from '@/utils/haptics';
import { goBackOrHome } from '@/utils/navigation';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { self } = useSession();
  const { refresh } = useRefresh();
  const { startNewBill, setGroup } = useBillDraft();

  const groups = useGroups();
  const balances = useGroupBalances(id);
  const overview = useBalanceOverview(id);
  const expenses = useExpenses({ groupId: id });
  const [editing, setEditing] = useState(false);

  const group = groups.data.find((candidate) => candidate.id === id);

  if (!group) {
    return (
      <Screen>
        {groups.loading ? null : (
          <Card>
            <AppText variant="body" muted>
              That group is no longer here.
            </AppText>
          </Card>
        )}
      </Screen>
    );
  }

  if (editing) return <GroupForm group={group} />;

  const addExpense = () => {
    startNewBill();
    setGroup(group.id);
    router.push('/bill/create');
  };

  const confirmDelete = () => {
    tapWarning();
    Alert.alert(
      `Delete ${group.name}?`,
      'Its expenses stay in your history, but they will no longer be grouped.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeGroup(group.id);
            refresh();
            goBackOrHome();
          },
        },
      ]
    );
  };

  return (
    <Screen footer={<PrimaryButton label="Add an expense" icon="+" onPress={addExpense} />}>
      <View style={styles.header}>
        <AppText variant="heading">{group.name}</AppText>
        {group.description ? (
          <AppText variant="body" muted>
            {group.description}
          </AppText>
        ) : null}
      </View>

      <BalanceHeadline owed={overview.data.owed} owes={overview.data.owes} />

      <Card>
        <SectionLabel>Where everyone stands</SectionLabel>
        {balances.data.map((balance) => (
          <View key={balance.participant.id} style={styles.line}>
            <AppText variant="body" numberOfLines={1} style={styles.lineName}>
              {balance.participant.id === self?.id ? 'You' : balance.participant.name}
            </AppText>
            <AppText
              variant="body"
              weight="600"
              color={
                balance.net > 0 ? colors.accent : balance.net < 0 ? colors.danger : colors.textMuted
              }
            >
              {balance.net > 0
                ? `up ${formatMoney(balance.net)}`
                : balance.net < 0
                  ? `down ${formatMoney(-balance.net)}`
                  : 'square'}
            </AppText>
          </View>
        ))}
        <PrimaryButton
          label="Settle up"
          variant="secondary"
          size="sm"
          onPress={() => router.push({ pathname: '/settle', params: { groupId: group.id } })}
        />
      </Card>

      <View style={styles.section}>
        <SectionLabel>Expenses</SectionLabel>
        {expenses.data.length === 0 ? (
          expenses.loading ? null : (
            <Card>
              <AppText variant="body" muted>
                No expenses in this group yet.
              </AppText>
            </Card>
          )
        ) : (
          expenses.data.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              selfId={self?.id}
              onPress={() =>
                router.push({
                  pathname: '/expense/[id]',
                  params: { id: expense.id },
                })
              }
            />
          ))
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Edit group" variant="secondary" onPress={() => setEditing(true)} />
        <PrimaryButton label="Delete group" variant="ghost" tone="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  lineName: {
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
  },
});
