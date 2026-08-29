import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { control, opacity, radius, spacing, useTheme } from '@/theme/theme';
import { tapSelection } from '@/utils/haptics';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stretch chips to fill the row, for 2-3 equally weighted choices. */
  fill?: boolean;
  /** What the whole group is for, e.g. "Filter by category". */
  accessibilityLabel?: string;
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  fill = false,
  accessibilityLabel,
}: ChipGroupProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!selected) tapSelection();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.chip,
              fill ? styles.fill : null,
              {
                backgroundColor: selected ? colors.primary : colors.surfaceStrong,
                opacity: pressed ? opacity.pressed : 1,
              },
            ]}
          >
            <AppText variant="body" weight="600" color={selected ? colors.onPrimary : colors.text}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: control.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: spacing.sm,
  },
});
