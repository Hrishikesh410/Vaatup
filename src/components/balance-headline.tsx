import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { usePressScale } from '@/components/press-scale';
import { borderWidth, radius, spacing, useTheme } from '@/theme/theme';
import type { Money } from '@/types/money';
import { formatMoney } from '@/utils/currency';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface BalanceHeadlineProps {
  owed: Money;
  owes: Money;
  onPress?: () => void;
}

/**
 * The number the user opens the app for.
 *
 * The net figure leads because it answers "am I up or down"; the two sides are
 * shown underneath because a net of zero can still mean money is moving in both
 * directions.
 */
export function BalanceHeadline({ owed, owes, onPress }: BalanceHeadlineProps) {
  const { colors, dark } = useTheme();
  const press = usePressScale();

  const net = owed - owes;
  const settled = owed === 0 && owes === 0;

  const headline = settled
    ? 'All settled'
    : net > 0
      ? `You are owed ${formatMoney(net)}`
      : net < 0
        ? `You owe ${formatMoney(-net)}`
        : 'Square overall';

  const body = (
    <>
      <AppText variant="caption" muted>
        {settled ? 'Nothing outstanding' : 'Overall'}
      </AppText>
      <AppText variant="heading" color={net < 0 ? colors.danger : colors.text}>
        {headline}
      </AppText>
      {settled ? null : (
        <View style={styles.split}>
          <View style={styles.side}>
            <AppText variant="caption" muted>
              Owed to you
            </AppText>
            <AppText variant="label" color={colors.accent}>
              {formatMoney(owed)}
            </AppText>
          </View>
          <View style={styles.side}>
            <AppText variant="caption" muted>
              You owe
            </AppText>
            <AppText variant="label" color={colors.danger}>
              {formatMoney(owes)}
            </AppText>
          </View>
        </View>
      )}
    </>
  );

  const surface = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: dark ? colors.border : 'transparent',
    },
  ];

  if (!onPress) return <View style={surface}>{body}</View>;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={headline}
      accessibilityHint="Opens your balances"
      style={[...surface, { transform: [{ scale: press.scale }] }]}
    >
      {body}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    gap: spacing.xs,
  },
  split: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  side: {
    gap: spacing.xs / 2,
  },
});
