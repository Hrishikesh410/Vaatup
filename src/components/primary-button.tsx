import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { usePressScale } from '@/components/press-scale';
import { borderWidth, control, opacity, radius, spacing, useTheme } from '@/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'whatsapp' | 'accent' | 'ghost';
export type ButtonSize = 'md' | 'sm';
export type ButtonTone = 'default' | 'danger';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** `danger` colours the label for a destructive action like deleting. */
  tone?: ButtonTone;
  disabled?: boolean;
  /** Small leading glyph, e.g. '+'. Kept as text to avoid an icon dependency. */
  icon?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** Overrides the spoken name when the visible label is too terse on its own. */
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  tone = 'default',
  disabled = false,
  icon,
  style,
  accessibilityHint,
  accessibilityLabel,
}: PrimaryButtonProps) {
  const { colors } = useTheme();
  const press = usePressScale();

  const background = {
    primary: colors.primary,
    secondary: colors.surface,
    whatsapp: colors.whatsapp,
    accent: colors.accent,
    ghost: 'transparent',
  }[variant];

  const variantForeground = {
    primary: colors.onPrimary,
    secondary: colors.text,
    whatsapp: colors.onWhatsapp,
    accent: colors.onAccent,
    ghost: colors.text,
  }[variant];

  // Only the flat variants recolour: `danger` on a filled button would put
  // red text on a coloured background.
  const foreground =
    tone === 'danger' && (variant === 'ghost' || variant === 'secondary')
      ? colors.danger
      : variantForeground;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={[
        styles.base,
        size === 'sm' ? styles.small : styles.medium,
        {
          backgroundColor: background,
          borderColor: variant === 'ghost' ? colors.border : 'transparent',
          borderWidth: variant === 'ghost' ? borderWidth.thin : 0,
          opacity: disabled ? opacity.disabled : 1,
          transform: [{ scale: disabled ? 1 : press.scale }],
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? (
          <AppText variant={size === 'sm' ? 'body' : 'label'} color={foreground} weight="600">
            {icon}
          </AppText>
        ) : null}
        <AppText variant={size === 'sm' ? 'body' : 'label'} color={foreground} weight="600">
          {label}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medium: {
    minHeight: control.lg,
    paddingHorizontal: spacing.lg,
  },
  small: {
    minHeight: control.sm,
    paddingHorizontal: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
