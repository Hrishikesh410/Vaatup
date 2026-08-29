import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { usePressScale } from '@/components/press-scale';
import { borderWidth, control, radius, spacing, useTheme } from '@/theme/theme';
import type { Expense } from '@/types/expense';
import type { Money } from '@/types/money';
import { formatMoney } from '@/utils/currency';
import { formatRelativeDay } from '@/utils/date';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ExpenseRowProps {
  expense: Expense;
  /**
   * The signed-in user's participant id, used to work out whether this expense
   * left them owed money or owing it.
   */
  selfId?: string;
  categoryIcon?: string;
  groupName?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * One line of expense history: what it was, and what it did to the user's
 * position. "You are owed" is the answer people actually scan a list for, so it
 * is computed per row from what the user paid versus what they owe.
 */
export function ExpenseRow({
  expense,
  selfId,
  categoryIcon,
  groupName,
  onPress,
  onLongPress,
}: ExpenseRowProps) {
  const { colors, dark } = useTheme();
  const press = usePressScale();

  const paid = selfId
    ? (expense.payers.find((payer) => payer.participantId === selfId)?.amountPaid ?? 0)
    : 0;
  const owed = selfId
    ? (expense.splits.find((split) => split.personId === selfId)?.amount ?? 0)
    : 0;
  const net: Money = paid - owed;

  const people = `${expense.splits.length} ${expense.splits.length === 1 ? 'person' : 'people'}`;
  const position =
    !selfId || net === 0
      ? null
      : net > 0
        ? `you lent ${formatMoney(net)}`
        : `you owe ${formatMoney(-net)}`;

  const meta = [people, formatRelativeDay(expense.spentAt), groupName].filter(Boolean).join(' · ');

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${expense.description}, ${formatMoney(expense.totalAmount)}, ${meta}${position ? `, ${position}` : ''}`}
      accessibilityHint={
        onLongPress ? 'Opens this expense. Long press to delete.' : 'Opens this expense.'
      }
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: dark ? colors.border : 'transparent',
          transform: [{ scale: press.scale }],
        },
      ]}
    >
      {categoryIcon ? (
        <View style={[styles.icon, { backgroundColor: colors.surfaceStrong }]}>
          <AppText variant="body">{categoryIcon}</AppText>
        </View>
      ) : null}

      <View style={styles.info}>
        <AppText variant="label" numberOfLines={1}>
          {expense.description}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {meta}
        </AppText>
      </View>

      <View style={styles.amounts}>
        <AppText variant="label">{formatMoney(expense.totalAmount)}</AppText>
        {position ? (
          <AppText variant="caption" weight="600" color={net > 0 ? colors.accent : colors.danger}>
            {position}
          </AppText>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: control.row,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  icon: {
    width: control.sm,
    height: control.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: spacing.xs / 2,
  },
});
