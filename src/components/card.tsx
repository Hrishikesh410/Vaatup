import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderWidth, radius, spacing, useTheme } from '@/theme/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, dark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          // In dark mode the surface barely separates from the background, so
          // the edge needs drawing.
          borderColor: dark ? colors.border : 'transparent',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <AppText variant="overline" muted style={styles.sectionLabel}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
});
