import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';

import { deleteExpense } from '@/application/expense-service';
import { repeatExpense } from '@/application/recurring-service';
import { markShareSettled, unmarkShareSettled } from '@/application/settlement-service';
import { shareExpense, shareExpenseSummary } from '@/application/whatsapp-share-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { CommentThread } from '@/components/comment-thread';
import { PersonRow } from '@/components/person-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { messageFor } from '@/domain/errors';
import { useExpenseDetail, useSettledIds } from '@/hooks/use-data';
import { useBillDraft } from '@/state/bill-draft';
import { useRefresh } from '@/state/refresh';
import { useSession } from '@/state/session';
import { radius, spacing, useTheme } from '@/theme/theme';
import type { ExpenseDetail } from '@/types/expense';
import type { ParticipantId } from '@/types/participant';
import type { RecurrenceFrequency } from '@/types/recurring';
import { formatMoney } from '@/utils/currency';
import { formatRelativeDay } from '@/utils/date';
import { tapSuccess, tapWarning } from '@/utils/haptics';
import { goBackOrHome } from '@/utils/navigation';
import { SPLIT_TYPE_LABELS } from '@/utils/split-labels';

const REPEAT_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'every week',
  monthly: 'every month',
  yearly: 'every year',
};

const REPEAT_CHOICES: { frequency: RecurrenceFrequency; label: string }[] = [
  { frequency: 'weekly', label: 'Weekly' },
  { frequency: 'monthly', label: 'Monthly' },
  { frequency: 'yearly', label: 'Yearly' },
];

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, self } = useSession();
  const { refresh } = useRefresh();
  const { hydrate } = useBillDraft();

  const expense = useExpenseDetail(id);
  const settled = useSettledIds(id);
  const [error, setError] = useState<string | null>(null);
  const [repeatMessage, setRepeatMessage] = useState<string | null>(null);

  if (!expense.data) {
    return (
      <Screen>
        {expense.loading ? null : (
          <Card>
            <AppText variant="body" muted>
              {expense.error
                ? messageFor(expense.error, 'Could not open that expense.')
                : 'That expense is no longer here.'}
            </AppText>
          </Card>
        )}
      </Screen>
    );
  }

  const detail = expense.data;
  const settledIds = settled.data;

  const nameFor = (participantId: ParticipantId) =>
    detail.participants.find((participant) => participant.id === participantId)?.name ?? 'Someone';

  const togglePaid = async (participantId: ParticipantId) => {
    if (!user) return;
    setError(null);
    try {
      if (settledIds.includes(participantId)) {
        await unmarkShareSettled(detail.id, participantId);
      } else {
        await markShareSettled(user.id, detail.id, participantId);
        tapSuccess();
      }
      refresh();
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not update that share.'));
    }
  };

  const sendReminder = async (participantId: ParticipantId) => {
    const result = await shareExpense(detail, participantId);
    if (!result.ok) {
      setError(
        result.reason === 'no-phone'
          ? `Add a phone number for ${nameFor(participantId)} to message them.`
          : 'WhatsApp could not be opened on this device.'
      );
    }
  };

  const confirmDelete = () => {
    tapWarning();
    Alert.alert(detail.description, 'Delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(detail.id);
          refresh();
          goBackOrHome();
        },
      },
    ]);
  };

  const startEdit = () => {
    hydrate(detail);
    router.push('/bill/create');
  };

  const startRepeating = async (frequency: RecurrenceFrequency) => {
    if (!user) return;
    setError(null);
    try {
      await repeatExpense(user.id, detail, frequency);
      tapSuccess();
      setRepeatMessage(`Set to repeat ${REPEAT_LABELS[frequency]}. Manage it under Profile.`);
      refresh();
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not set that to repeat.'));
    }
  };

  return (
    <Screen
      footer={<PrimaryButton label="Share summary" onPress={() => shareExpenseSummary(detail)} />}
    >
      <Header detail={detail} />

      <Card>
        <SectionLabel>Paid by</SectionLabel>
        {detail.payers.map((payer) => (
          <View key={payer.participantId} style={styles.line}>
            <AppText variant="body" numberOfLines={1} style={styles.lineName}>
              {payer.participantId === self?.id ? 'You' : nameFor(payer.participantId)}
            </AppText>
            <AppText variant="label">{formatMoney(payer.amountPaid)}</AppText>
          </View>
        ))}
      </Card>

      <Card>
        <SectionLabel>Split {SPLIT_TYPE_LABELS[detail.splitType].toLowerCase()}</SectionLabel>
        {detail.splits.map((split) => {
          const isSettled = settledIds.includes(split.personId);
          const paidForThis = detail.payers.some((payer) => payer.participantId === split.personId);

          return (
            <PersonRow
              key={split.personId}
              name={split.personId === self?.id ? 'You' : nameFor(split.personId)}
              subtitle={paidForThis ? 'Paid for this' : isSettled ? 'Settled' : 'Owes their share'}
              subtitleTone={isSettled || paidForThis ? 'accent' : 'muted'}
              struck={isSettled}
              right={<AppText variant="label">{formatMoney(split.amount)}</AppText>}
              below={
                paidForThis ? null : (
                  <View style={styles.rowActions}>
                    <PrimaryButton
                      label={isSettled ? 'Undo settled' : 'Mark settled'}
                      variant="secondary"
                      size="sm"
                      onPress={() => togglePaid(split.personId)}
                    />
                    {split.personId === self?.id ? null : (
                      <PrimaryButton
                        label="WhatsApp"
                        variant="ghost"
                        size="sm"
                        onPress={() => sendReminder(split.personId)}
                        accessibilityLabel={`Message ${nameFor(split.personId)} on WhatsApp`}
                      />
                    )}
                  </View>
                )
              }
            />
          );
        })}
      </Card>

      {detail.items.length > 0 ? (
        <Card>
          <SectionLabel>Items</SectionLabel>
          {detail.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <AppText variant="body" numberOfLines={1} style={styles.lineName}>
                {item.name}
              </AppText>
              <AppText variant="body">{formatMoney(item.amount)}</AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {detail.notes ? (
        <Card>
          <SectionLabel>Notes</SectionLabel>
          <AppText variant="body">{detail.notes}</AppText>
        </Card>
      ) : null}

      {detail.receiptUri ? (
        <Card>
          <SectionLabel>Receipt</SectionLabel>
          <Image
            source={{ uri: detail.receiptUri }}
            style={styles.receipt}
            resizeMode="cover"
            accessibilityLabel="Receipt photo"
          />
        </Card>
      ) : null}

      {self ? <CommentThread expenseId={detail.id} authorParticipantId={self.id} /> : null}

      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}

      <Card>
        <SectionLabel>Repeat this</SectionLabel>
        <AppText variant="caption" muted>
          {repeatMessage ?? 'For rent, a subscription, or the weekly cab.'}
        </AppText>
        <View style={styles.rowActions}>
          {REPEAT_CHOICES.map(({ frequency, label }) => (
            <PrimaryButton
              key={frequency}
              label={label}
              variant="secondary"
              size="sm"
              onPress={() => startRepeating(frequency)}
              accessibilityLabel={`Repeat this expense ${label.toLowerCase()}`}
            />
          ))}
        </View>
      </Card>

      <View style={styles.footerActions}>
        <PrimaryButton label="Edit" variant="secondary" onPress={startEdit} />
        <PrimaryButton label="Delete" variant="ghost" tone="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

function Header({ detail }: { detail: ExpenseDetail }) {
  const { colors } = useTheme();

  const extras = [
    detail.tipAmount > 0 ? `tip ${formatMoney(detail.tipAmount)}` : null,
    detail.taxAmount > 0 ? `tax ${formatMoney(detail.taxAmount)}` : null,
  ].filter(Boolean);

  return (
    <View style={styles.header}>
      <AppText variant="caption" muted>
        {detail.categoryIcon} {detail.categoryLabel}
        {detail.groupName ? ` · ${detail.groupName}` : ''}
      </AppText>
      <AppText variant="heading">{detail.description}</AppText>
      <AppText variant="display" color={colors.text}>
        {formatMoney(detail.totalAmount)}
      </AppText>
      <AppText variant="caption" muted>
        {formatRelativeDay(detail.spentAt)}
        {extras.length > 0 ? ` · includes ${extras.join(' and ')}` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
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
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  receipt: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
  },
  footerActions: {
    gap: spacing.sm,
  },
});
