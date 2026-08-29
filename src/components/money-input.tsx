import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import {
  borderWidth,
  control,
  opacity,
  radius,
  spacing,
  typography,
  useTheme,
  webFocusReset,
} from '@/theme/theme';
import type { Currency, Money } from '@/types/money';
import { DEFAULT_CURRENCY, parseMoney, toInputValue } from '@/utils/currency';

export interface MoneyInputProps {
  value: Money;
  onChangeValue: (value: Money) => void;
  currency?: Currency;
  /** 'hero' is the big bill-amount field; 'inline' fits inside a person row. */
  size?: 'hero' | 'inline';
  placeholder?: string;
  autoFocus?: boolean;
  align?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Keeps the user's raw keystrokes in local state (so "12." can exist mid-typing)
 * while reporting a clean integer minor-unit value upward.
 */
export function MoneyInput({
  value,
  onChangeValue,
  currency = DEFAULT_CURRENCY,
  size = 'inline',
  placeholder = '0',
  autoFocus = false,
  align,
  style,
  accessibilityLabel,
}: MoneyInputProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(() => toInputValue(value, currency));
  const [focused, setFocused] = useState(false);
  const lastReported = useRef(value);

  useEffect(() => {
    if (value !== lastReported.current) {
      lastReported.current = value;
      setText(toInputValue(value, currency));
    }
  }, [value, currency]);

  const handleChangeText = (next: string) => {
    const sanitized = keepDigitsAndDecimals(next, currency.minorUnitDigits);
    setText(sanitized);
    const minor = sanitized === '' ? 0 : (parseMoney(sanitized, currency) ?? 0);
    lastReported.current = minor;
    onChangeValue(minor);
  };

  const hero = size === 'hero';
  const textAlign = align ?? (hero ? 'left' : 'right');

  return (
    <View
      style={[
        styles.wrapper,
        hero ? styles.hero : styles.inline,
        hero
          ? { borderBottomColor: focused ? colors.focus : colors.border }
          : {
              backgroundColor: colors.surfaceStrong,
              borderColor: focused ? colors.focus : 'transparent',
            },
        style,
      ]}
    >
      <AppText
        variant={hero ? 'amount' : 'body'}
        muted={!hero && text === ''}
        style={hero ? styles.heroSymbol : undefined}
      >
        {currency.symbol}
      </AppText>
      <TextInput
        value={text}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        // The inline field has a definite width; unbounded scaling would clip
        // the amount rather than wrap it.
        maxFontSizeMultiplier={hero ? 1.3 : 1.2}
        autoFocus={autoFocus}
        selectTextOnFocus={!hero}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.input,
          hero ? styles.heroInput : styles.inlineInput,
          { color: colors.text, textAlign },
          webFocusReset,
        ]}
      />
    </View>
  );
}

/** Digits with at most one separator and no more decimals than the currency has. */
function keepDigitsAndDecimals(input: string, minorUnitDigits: number): string {
  const cleaned = input.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole;
  if (minorUnitDigits === 0) return whole;
  return `${whole}.${rest.join('').slice(0, minorUnitDigits)}`;
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hero: {
    gap: spacing.sm,
    // The field owns its underline so it can double as the focus indicator.
    borderBottomWidth: borderWidth.thin,
    paddingBottom: spacing.md,
  },
  inline: {
    minHeight: control.md,
    // Definite width: a flexible field would take its size from the text input's
    // intrinsic width and squeeze the name next to it.
    width: 128,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thick,
    gap: spacing.xs,
  },
  heroSymbol: {
    opacity: opacity.disabled,
  },
  input: {
    flex: 1,
    // Lets the field shrink to its container instead of its intrinsic text width.
    minWidth: 0,
    padding: 0,
  },
  heroInput: {
    fontSize: typography.amount.fontSize,
    fontWeight: typography.amount.fontWeight,
    letterSpacing: typography.amount.letterSpacing,
    minHeight: control.lg,
  },
  inlineInput: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
});
