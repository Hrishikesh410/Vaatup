import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderWidth, footerElevation, spacing, useTheme } from '@/theme/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Pinned to the bottom above the safe area — where the main action lives. */
  footer?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Common screen chrome: background, keyboard avoidance, and a footer that keeps
 * the primary action within thumb reach.
 *
 * Keyboard handling is react-native-keyboard-controller's rather than React
 * Native's `KeyboardAvoidingView`. The app draws edge to edge, and under that
 * Android stopped resizing the window when the keyboard opens, so the
 * `adjustResize` the manifest asks for moves nothing and a field low on the
 * screen ends up behind the keys.
 */
export function Screen({ children, footer, scroll = true, contentStyle }: ScreenProps) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  // Measured rather than assumed: it is how far a focused field has to clear
  // the footer, and footers here run from one button to a button and two lines
  // of explanation.
  const [footerHeight, setFooterHeight] = useState(0);

  const body = scroll ? (
    <KeyboardAwareScrollView
      bottomOffset={footerHeight + spacing.md}
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {body}
      {footer ? (
        // The footer rides above the keyboard: the action it holds is usually
        // what the user is typing towards.
        <KeyboardStickyView>
          <View
            onLayout={(event: LayoutChangeEvent) =>
              setFooterHeight(event.nativeEvent.layout.height)
            }
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, spacing.lg),
                borderTopColor: colors.border,
                backgroundColor: colors.background,
              },
              footerElevation(colors, dark),
            ]}
          >
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
    gap: spacing.sm,
  },
});
