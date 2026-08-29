import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import {
  borderWidth,
  control,
  radius,
  spacing,
  typography,
  useTheme,
  webFocusReset,
} from '@/theme/theme';

export interface PercentInputProps {
  value: number;
  onChangeValue: (value: number) => void;
  accessibilityLabel?: string;
}

/** Percentage field with up to two decimals, mirroring MoneyInput's behaviour. */
export function PercentInput({ value, onChangeValue, accessibilityLabel }: PercentInputProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(() => formatPercentage(value));
  const [focused, setFocused] = useState(false);
  const lastReported = useRef(value);

  useEffect(() => {
    if (value !== lastReported.current) {
      lastReported.current = value;
      setText(formatPercentage(value));
    }
  }, [value]);

  const handleChangeText = (next: string) => {
    const sanitized = keepDigitsAndDecimals(next);
    setText(sanitized);
    const parsed = sanitized === '' ? 0 : Number(sanitized);
    // Over 100 is left alone rather than clamped, so the field never disagrees
    // with the running total; validation is what blocks an unbalanced split.
    const percent = Number.isFinite(parsed) ? parsed : 0;
    lastReported.current = percent;
    onChangeValue(percent);
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.surfaceStrong,
          borderColor: focused ? colors.focus : 'transparent',
        },
      ]}
    >
      <TextInput
        value={text}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={1.2}
        selectTextOnFocus
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { color: colors.text }, webFocusReset]}
      />
      <AppText variant="body" muted weight="600">
        %
      </AppText>
    </View>
  );
}

function formatPercentage(value: number): string {
  if (value === 0) return '';
  return String(Math.round(value * 100) / 100);
}

function keepDigitsAndDecimals(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join('').slice(0, 2)}`;
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: control.md,
    width: 104,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thick,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    // Lets the field shrink to its container instead of its intrinsic text width.
    minWidth: 0,
    padding: 0,
    textAlign: 'right',
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
});
