import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { usePressScale } from '@/components/press-scale';
import { borderWidth, control, opacity, radius, spacing, useTheme } from '@/theme/theme';
import { tapSelection } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ShareStepperProps {
  value: number;
  onChangeValue: (value: number) => void;
  /** Name of the person, used to label both buttons for screen readers. */
  personName: string;
}

/**
 * Share counts are small whole numbers — one for most people, two for someone
 * bringing a partner — so a stepper is faster and less error-prone than a text
 * field, and it makes an invalid value impossible to type.
 */
export function ShareStepper({ value, onChangeValue, personName }: ShareStepperProps) {
  const { colors } = useTheme();
  const shares = Math.max(0, Math.trunc(value));

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surfaceStrong }]}>
      <StepButton
        label="−"
        accessibilityLabel={`One less share for ${personName}`}
        disabled={shares === 0}
        onPress={() => onChangeValue(shares - 1)}
      />
      <View style={styles.value}>
        <AppText variant="label" accessibilityLabel={`${shares} shares for ${personName}`}>
          {shares}
        </AppText>
      </View>
      <StepButton
        label="+"
        accessibilityLabel={`One more share for ${personName}`}
        onPress={() => onChangeValue(shares + 1)}
      />
    </View>
  );
}

interface StepButtonProps {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}

function StepButton({ label, accessibilityLabel, onPress, disabled }: StepButtonProps) {
  const { colors } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapSelection();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={spacing.xs}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: colors.border,
          opacity: disabled ? opacity.disabled : pressed ? opacity.pressed : 1,
          transform: [{ scale }],
        },
      ]}
    >
      <AppText variant="label" weight="600">
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    padding: spacing.xxs,
    gap: spacing.xxs,
  },
  button: {
    width: control.sm,
    height: control.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    borderWidth: borderWidth.thin,
  },
  value: {
    minWidth: control.sm,
    alignItems: 'center',
  },
});
