import { Alert, StyleSheet, View } from 'react-native';

import { removeRecurring, setRecurringActive } from '@/application/recurring-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { useRecurring } from '@/hooks/use-data';
import { useRefresh } from '@/state/refresh';
import { spacing, useTheme } from '@/theme/theme';
import type { RecurrenceFrequency, RecurringExpense } from '@/types/recurring';
import { formatMoney } from '@/utils/currency';
import { formatRelativeDay } from '@/utils/date';
import { tapWarning } from '@/utils/haptics';

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

/**
 * Expenses that come back — rent, the shared subscription, the weekly cab.
 *
 * A template is turned into a real expense when the app is next opened after it
 * comes due, so nothing appears behind the user's back while they are using it.
 */
export default function RecurringScreen() {
  const { colors } = useTheme();
  const { refresh } = useRefresh();
  const recurring = useRecurring();

  const togglePaused = async (template: RecurringExpense) => {
    await setRecurringActive(template.id, !template.isActive);
    refresh();
  };

  const confirmRemove = (template: RecurringExpense) => {
    tapWarning();
    Alert.alert(template.description, 'Stop repeating this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeRecurring(template.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <Screen>
      <AppText variant="body" muted>
        Expenses set to repeat are added the next time you open VaatUp after they come due. Turn one
        into a repeating expense from its own screen.
      </AppText>

      {recurring.data.length === 0 ? (
        recurring.loading ? null : (
          <Card>
            <AppText variant="body" muted>
              Nothing repeating yet.
            </AppText>
          </Card>
        )
      ) : (
        recurring.data.map((template) => (
          <Card key={template.id}>
            <View style={styles.header}>
              <SectionLabel>{template.description}</SectionLabel>
              <AppText variant="label">{formatMoney(template.totalAmount)}</AppText>
            </View>

            <AppText variant="caption" muted>
              {FREQUENCY_LABELS[template.frequency]} · next {formatRelativeDay(template.nextDueAt)}
              {template.lastRunAt ? ` · last added ${formatRelativeDay(template.lastRunAt)}` : ''}
            </AppText>

            {template.isActive ? null : (
              <AppText variant="caption" color={colors.textMuted} weight="600">
                Paused
              </AppText>
            )}

            <View style={styles.actions}>
              <PrimaryButton
                label={template.isActive ? 'Pause' : 'Resume'}
                variant="secondary"
                size="sm"
                onPress={() => togglePaused(template)}
              />
              <PrimaryButton
                label="Remove"
                variant="ghost"
                size="sm"
                tone="danger"
                onPress={() => confirmRemove(template)}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
