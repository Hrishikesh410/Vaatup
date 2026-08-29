import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

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

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  const borderColor = error ? colors.danger : focused ? colors.focus : 'transparent';

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="caption" muted>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={1.5}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        {...rest}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceStrong,
            color: colors.text,
            borderColor,
          },
          webFocusReset,
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  input: {
    minHeight: control.lg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.label.fontSize,
    borderWidth: borderWidth.thick,
  },
});
