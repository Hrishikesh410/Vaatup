import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { spacing, useTheme } from '@/theme/theme';
import type { BillTotals } from '@/types/bill';
import type { Currency } from '@/types/money';
import { DEFAULT_CURRENCY, formatMoney } from '@/utils/currency';

export interface SplitSummaryProps {
  totals: BillTotals;
  currency?: Currency;
  /** Hide zero tip/tax rows so a plain bill shows a single clean total. */
  compact?: boolean;
}

/** The Bill / Tip / Tax / Total breakdown. */
export function SplitSummary({
  totals,
  currency = DEFAULT_CURRENCY,
  compact = true,
}: SplitSummaryProps) {
  const { colors } = useTheme();
  const rows: { label: string; amount: number }[] = [{ label: 'Bill', amount: totals.base }];

  if (!compact || totals.tip > 0) rows.push({ label: 'Tip', amount: totals.tip });
  if (!compact || totals.tax > 0) rows.push({ label: 'Tax', amount: totals.tax });

  return (
    <View style={styles.container}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <AppText variant="body" muted>
            {row.label}
          </AppText>
          <AppText variant="body">{formatMoney(row.amount, currency)}</AppText>
        </View>
      ))}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <AppText variant="label">Total</AppText>
        <AppText variant="label">{formatMoney(totals.total, currency)}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
});
