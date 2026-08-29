import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderWidth, opacity, spacing, useTheme } from '@/theme/theme';
import { goBackOrHome } from '@/utils/navigation';

/**
 * One back control for both platforms. iOS would otherwise label the native
 * button with the previous screen's title (which truncates to "Back" anyway on
 * long titles) and Android would draw a bare arrow with no label, so the two
 * platforms disagree on the most-used control in the app.
 *
 * The chevron is drawn from a rotated bordered box to avoid pulling in an icon
 * font for a single glyph, matching how the rest of the app handles icons.
 */
export interface HeaderBackButtonProps {
  label?: string;
}

export function HeaderBackButton({ label = 'Back' }: HeaderBackButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={goBackOrHome}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Returns to the previous step"
      hitSlop={16}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <View style={[styles.chevron, { borderColor: colors.text }]} />
      <AppText variant="body" weight="600">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    // Own padding rather than relying on the header's inset, which differs
    // between iOS, Android and web and can clip the chevron.
    paddingHorizontal: spacing.xs,
  },
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: borderWidth.thick,
    borderBottomWidth: borderWidth.thick,
    transform: [{ rotate: '45deg' }],
  },
  pressed: {
    opacity: opacity.muted,
  },
});
