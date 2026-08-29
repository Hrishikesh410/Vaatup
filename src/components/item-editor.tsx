import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MoneyInput } from '@/components/money-input';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { spacing, useTheme } from '@/theme/theme';
import type { DraftItem } from '@/types/bill';
import type { Money } from '@/types/money';
import { formatMoney } from '@/utils/currency';
import { tapSelection } from '@/utils/haptics';

export interface ItemEditorProps {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  /** The bill total, so the editor can say whether the lines account for it. */
  total: Money;
  /** Offered when the lines add up to something other than the current total. */
  onUseItemsTotal?: (amount: Money) => void;
}

/**
 * Lists what was actually ordered.
 *
 * Itemising is optional and does not change the split on its own — it is there
 * so an expense can be explained later ("what was the ₹340 line?") and so a
 * future by-item split has the data it needs.
 */
export function ItemEditor({ items, onChange, total, onUseItemsTotal }: ItemEditorProps) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);

  const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const canAdd = name.trim() !== '' && amount > 0;

  const add = () => {
    if (!canAdd) return;
    tapSelection();
    onChange([...items, { name: name.trim(), amount, assignedTo: [] }]);
    setName('');
    setAmount(0);
  };

  const removeAt = (position: number) => {
    onChange(items.filter((_, index) => index !== position));
  };

  return (
    <View style={styles.container}>
      {items.map((item, position) => (
        <View key={`${item.name}-${position}`} style={styles.row}>
          <AppText variant="body" numberOfLines={1} style={styles.name}>
            {item.name}
          </AppText>
          <AppText variant="body">{formatMoney(item.amount)}</AppText>
          <PrimaryButton
            label="✕"
            variant="ghost"
            size="sm"
            tone="danger"
            onPress={() => removeAt(position)}
            accessibilityLabel={`Remove ${item.name}`}
          />
        </View>
      ))}

      {items.length > 0 ? (
        <View style={styles.row}>
          <AppText variant="caption" muted style={styles.name}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </AppText>
          <AppText variant="caption" weight="600">
            {formatMoney(itemsTotal)}
          </AppText>
        </View>
      ) : null}

      {items.length > 0 && itemsTotal !== total && onUseItemsTotal ? (
        <PrimaryButton
          label={`Set bill to ${formatMoney(itemsTotal)}`}
          variant="ghost"
          size="sm"
          onPress={() => onUseItemsTotal(itemsTotal)}
          style={styles.selfStart}
        />
      ) : null}

      <View style={styles.addRow}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Paneer tikka"
          style={styles.nameField}
          accessibilityLabel="Item name"
          returnKeyType="next"
          maxLength={40}
        />
        <MoneyInput
          value={amount}
          onChangeValue={setAmount}
          size="inline"
          accessibilityLabel="Item amount"
        />
      </View>
      <PrimaryButton
        label="Add item"
        icon="+"
        variant="secondary"
        size="sm"
        disabled={!canAdd}
        onPress={add}
        style={styles.selfStart}
      />

      <AppText variant="caption" color={colors.textMuted}>
        Itemising is only a record of what was ordered — the split is still whichever one you choose
        next.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    flex: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  nameField: {
    flex: 1,
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
});
