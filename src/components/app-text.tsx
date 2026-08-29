import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type TypographyVariant } from '@/theme/theme';

export type TextVariant = TypographyVariant;

/**
 * Caps on the OS font-size setting. Body copy is free to grow, but the big
 * numbers already dominate their row and would push the layout apart, so they
 * scale less. Nothing is pinned at 1: text must still respond to the setting.
 */
const MAX_SCALE: Record<TypographyVariant, number> = {
  amount: 1.3,
  display: 1.3,
  heading: 1.4,
  label: 1.5,
  body: 1.8,
  caption: 1.8,
  overline: 1.8,
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  muted?: boolean;
  /** Overrides the palette colour, e.g. for danger or accent text. */
  color?: string;
  weight?: '400' | '500' | '600' | '700';
  /** Crosses the text out, e.g. a share that has been paid. */
  strikethrough?: boolean;
}

export function AppText({
  variant = 'body',
  muted = false,
  color,
  weight,
  strikethrough = false,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      style={[
        typography[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        weight ? { fontWeight: weight } : null,
        strikethrough ? { textDecorationLine: 'line-through' } : null,
        style,
      ]}
    />
  );
}
