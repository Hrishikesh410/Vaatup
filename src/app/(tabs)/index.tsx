import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BalanceHeadline } from '@/components/balance-headline';
import { Card, SectionLabel } from '@/components/card';
import { ExpenseRow } from '@/components/expense-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { useBalanceOverview, useExpenses, useSettlements } from '@/hooks/use-data';
import { useBillDraft } from '@/state/bill-draft';
import { useSession } from '@/state/session';
import { loadCollector } from '@/storage/collector';
import { opacity, spacing, useTheme } from '@/theme/theme';
import { formatMoney } from '@/utils/currency';
import { formatRelativeDay } from '@/utils/date';

const RECENT_LIMIT = 5;

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { self } = useSession();
  const { startNewBill } = useBillDraft();

  const overview = useBalanceOverview();
  const recentExpenses = useExpenses({ limit: RECENT_LIMIT });
  const recentSettlements = useSettlements({ limit: 3 });
  const [upiReady, setUpiReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCollector().then((collector) => {
        if (active) setUpiReady(collector !== null && collector.enabled);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const startExpense = () => {
    startNewBill();
    router.push('/bill/create');
  };

  const nameFor = (participantId: string) =>
    overview.data.people.find((person) => person.participant.id === participantId)?.participant
      .name ?? (participantId === self?.id ? 'You' : 'Someone');

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + spacing.xl }}
      footer={<PrimaryButton label="Add an expense" icon="+" onPress={startExpense} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <AppText variant="display" style={styles.heroTitle}>
            VaatUp
          </AppText>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Payment details"
            accessibilityHint="Set the UPI ID people pay you at"
            hitSlop={12}
            style={({ pressed }) => (pressed ? { opacity: opacity.muted } : null)}
          >
            <AppText variant="caption" weight="600" color={colors.accent}>
              {upiReady ? 'UPI on' : 'Add UPI'}
            </AppText>
          </Pressable>
        </View>
      </View>

      <BalanceHeadline
        owed={overview.data.owed}
        owes={overview.data.owes}
        onPress={() => router.push('/balances')}
      />

      {overview.data.people.length > 0 ? (
        <Card>
          <SectionLabel>Who owes what</SectionLabel>
          {overview.data.people.slice(0, 4).map(({ participant, net }) => (
            <View key={participant.id} style={styles.balanceRow}>
              <AppText variant="body" numberOfLines={1} style={styles.balanceName}>
                {participant.name}
              </AppText>
              <AppText variant="body" weight="600" color={net > 0 ? colors.accent : colors.danger}>
                {net > 0 ? `owes you ${formatMoney(net)}` : `you owe ${formatMoney(-net)}`}
              </AppText>
            </View>
          ))}
          {overview.data.people.length > 4 ? (
            <PrimaryButton
              label="See all balances"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/balances')}
            />
          ) : null}
        </Card>
      ) : null}

      <View style={styles.section}>
        <SectionLabel>Recent expenses</SectionLabel>

        {recentExpenses.data.length === 0 ? (
          // Nothing is rendered on the very first pass, so the empty state does
          // not flash before the database answers.
          recentExpenses.loading ? null : (
            <Card>
              <AppText variant="body" muted>
                Nothing here yet. Add an expense and VaatUp will work out who owes what.
              </AppText>
            </Card>
          )
        ) : (
          recentExpenses.data.map((expense) => (
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

      {recentSettlements.data.length > 0 ? (
        <Card>
          <SectionLabel>Recent payments</SectionLabel>
          {recentSettlements.data.map((settlement) => (
            <View key={settlement.id} style={styles.balanceRow}>
              <AppText variant="body" numberOfLines={1} style={styles.balanceName}>
                {nameFor(settlement.fromParticipantId)} → {nameFor(settlement.toParticipantId)}
              </AppText>
              <AppText variant="caption" muted>
                {formatMoney(settlement.amount)} · {formatRelativeDay(settlement.settledAt)}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroTitle: {
    flexShrink: 1,
  },
  section: {
    gap: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  balanceName: {
    flex: 1,
  },
});
