import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { MoneyInput } from '@/components/money-input';
import { useBillDraft } from '@/state/bill-draft';
import { borderWidth, control, opacity, radius, spacing, useTheme } from '@/theme/theme';
import { formatMoney } from '@/utils/currency';
import { tapSelection } from '@/utils/haptics';

/**
 * Who paid the bill.
 *
 * Most splits have one payer, so the common case is a single tap and no amounts
 * to type. Picking a second person switches to entering amounts, because at
 * that point the app cannot know the division — and it refuses to guess.
 */
export function PayerPicker() {
  const { colors } = useTheme();
  const { draft, totals, payers, setPayerIds, setPayment } = useBillDraft();

  if (draft.people.length === 0) return null;

  const selected = payers.map((payer) => payer.participantId);
  const multiple = selected.length > 1;
  const entered = payers.reduce((sum, payer) => sum + payer.amountPaid, 0);
  const gap = totals.total - entered;

  const toggle = (id: string) => {
    tapSelection();
    if (selected.includes(id)) {
      // The last payer cannot be removed: something has to have been paid.
      if (selected.length === 1) return;
      setPayerIds(selected.filter((current) => current !== id));
      return;
    }
    setPayerIds([...selected, id]);
  };

  return (
    <Card>
      <SectionLabel>Paid by</SectionLabel>

      <View style={styles.chips}>
        {draft.people.map((person) => {
          const active = selected.includes(person.id);
          return (
            <Pressable
              key={person.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${person.name} paid`}
              onPress={() => toggle(person.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surfaceStrong,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? opacity.pressed : 1,
                },
              ]}
            >
              <AppText variant="body" weight="600" color={active ? colors.onPrimary : colors.text}>
                {person.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {multiple ? (
        <>
          {draft.people
            .filter((person) => selected.includes(person.id))
            .map((person) => (
              <View key={person.id} style={styles.paymentRow}>
                <AppText variant="body" numberOfLines={1} style={styles.paymentName}>
                  {person.name}
                </AppText>
                <MoneyInput
                  value={draft.payments[person.id] ?? 0}
                  onChangeValue={(value) => setPayment(person.id, value)}
                  accessibilityLabel={`Amount paid by ${person.name}`}
                />
              </View>
            ))}
          <AppText
            variant="caption"
            color={gap === 0 ? colors.textMuted : colors.danger}
            weight="600"
          >
            {gap === 0
              ? `Payments add up to ${formatMoney(totals.total)}.`
              : gap > 0
                ? `${formatMoney(gap)} of the total is unaccounted for.`
                : `Payments are ${formatMoney(-gap)} over the total.`}
          </AppText>
        </>
      ) : (
        <AppText variant="caption" muted>
          Tap another name if more than one person paid.
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: control.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: control.md,
  },
  paymentName: {
    flex: 1,
  },
});
