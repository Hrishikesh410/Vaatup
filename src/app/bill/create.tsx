import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { ChipGroup, type ChipOption } from '@/components/chip-group';
import { ItemEditor } from '@/components/item-editor';
import { MoneyInput } from '@/components/money-input';
import { PrimaryButton } from '@/components/primary-button';
import { ReceiptPicker } from '@/components/receipt-picker';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCategories, useGroups } from '@/hooks/use-data';
import { useBillDraft } from '@/state/bill-draft';
import { spacing, useTheme } from '@/theme/theme';
import type { Tip } from '@/types/bill';
import { formatMoney } from '@/utils/currency';
import { validateBillAmount } from '@/utils/validation';

type TipChoice = 'none' | '5' | '10' | '15' | 'custom';

const TIP_OPTIONS: ChipOption<TipChoice>[] = [
  { value: 'none', label: 'No tip' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: 'custom', label: 'Custom' },
];

function tipChoiceOf(tip: Tip): TipChoice {
  if (tip.kind === 'none') return 'none';
  if (tip.kind === 'amount') return 'custom';
  return tip.percent === 5 || tip.percent === 10 || tip.percent === 15
    ? (String(tip.percent) as TipChoice)
    : 'custom';
}

export default function CreateBillScreen() {
  const { colors } = useTheme();
  const {
    draft,
    totals,
    setName,
    setBase,
    setTip,
    setTax,
    setCategory,
    setGroup,
    setNotes,
    setReceipt,
    setItems,
  } = useBillDraft();
  const [showTax, setShowTax] = useState(draft.tax > 0);
  const [showItems, setShowItems] = useState(draft.items.length > 0);

  const categories = useCategories();
  const groups = useGroups();

  const categoryOptions: ChipOption<string>[] = categories.data.map((category) => ({
    value: category.id,
    label: `${category.icon} ${category.label}`,
  }));

  const groupOptions: ChipOption<string>[] = [
    { value: '', label: 'No group' },
    ...groups.data.map((group) => ({ value: group.id, label: group.name })),
  ];

  const amountCheck = validateBillAmount(draft.base === 0 ? null : draft.base);
  const choice = tipChoiceOf(draft.tip);

  const handleTipChoice = (next: TipChoice) => {
    if (next === 'none') return setTip({ kind: 'none' });
    if (next === 'custom') return setTip({ kind: 'amount', amount: 0 });
    setTip({ kind: 'percent', percent: Number(next) });
  };

  return (
    <Screen
      footer={
        <>
          {amountCheck.valid ? (
            <View style={styles.totalRow}>
              <AppText variant="body" muted>
                Total
              </AppText>
              <AppText variant="label">{formatMoney(totals.total)}</AppText>
            </View>
          ) : (
            <AppText variant="caption" muted>
              {amountCheck.message}
            </AppText>
          )}
          <PrimaryButton
            label="Add people"
            disabled={!amountCheck.valid}
            onPress={() => router.push('/bill/people')}
          />
        </>
      }
    >
      <View style={styles.block}>
        <SectionLabel>Total bill</SectionLabel>
        <MoneyInput
          value={draft.base}
          onChangeValue={setBase}
          size="hero"
          autoFocus
          accessibilityLabel="Total bill amount"
        />
      </View>

      <TextField
        label="Bill name (optional)"
        value={draft.name}
        onChangeText={setName}
        placeholder="Dinner at ABC Restaurant"
        returnKeyType="done"
        maxLength={60}
      />

      <Card>
        <View style={styles.cardHeader}>
          <SectionLabel>Tip</SectionLabel>
          {totals.tip > 0 ? (
            <AppText variant="caption" color={colors.accent} weight="600">
              {formatMoney(totals.tip)}
            </AppText>
          ) : null}
        </View>
        <ChipGroup options={TIP_OPTIONS} value={choice} onChange={handleTipChoice} />
        {draft.tip.kind === 'amount' ? (
          <View style={styles.inlineRow}>
            <AppText variant="body" muted>
              Tip amount
            </AppText>
            <MoneyInput
              value={draft.tip.amount}
              onChangeValue={(amount) => setTip({ kind: 'amount', amount })}
              accessibilityLabel="Custom tip amount"
              autoFocus
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <SectionLabel>Tax</SectionLabel>
          {totals.tax > 0 ? (
            <AppText variant="caption" color={colors.accent} weight="600">
              {formatMoney(totals.tax)}
            </AppText>
          ) : null}
        </View>
        {showTax ? (
          <View style={styles.inlineRow}>
            <AppText variant="body" muted>
              Tax amount
            </AppText>
            <MoneyInput
              value={draft.tax}
              onChangeValue={setTax}
              accessibilityLabel="Tax amount"
              autoFocus
            />
          </View>
        ) : (
          <>
            <AppText variant="body" muted>
              Only if it isn&apos;t already in the bill.
            </AppText>
            <PrimaryButton
              label="Add tax"
              icon="+"
              variant="ghost"
              size="sm"
              onPress={() => setShowTax(true)}
              style={styles.selfStart}
            />
          </>
        )}
      </Card>

      <Card>
        <SectionLabel>Category</SectionLabel>
        <ChipGroup
          options={categoryOptions}
          value={draft.categoryId}
          onChange={setCategory}
          accessibilityLabel="Choose a category"
        />
      </Card>

      {groups.data.length > 0 ? (
        <Card>
          <SectionLabel>Group</SectionLabel>
          <ChipGroup
            options={groupOptions}
            value={draft.groupId ?? ''}
            onChange={(next) => setGroup(next === '' ? undefined : next)}
            accessibilityLabel="Choose a group"
          />
        </Card>
      ) : null}

      <Card>
        <View style={styles.cardHeader}>
          <SectionLabel>Items</SectionLabel>
          {draft.items.length === 0 ? (
            <PrimaryButton
              label="Itemise"
              icon="+"
              variant="ghost"
              size="sm"
              onPress={() => setShowItems(true)}
            />
          ) : null}
        </View>
        {showItems || draft.items.length > 0 ? (
          <ItemEditor
            items={draft.items}
            onChange={setItems}
            total={draft.base}
            onUseItemsTotal={setBase}
          />
        ) : (
          <AppText variant="body" muted>
            Optional. List the dishes if you want a record of them.
          </AppText>
        )}
      </Card>

      <Card>
        <SectionLabel>Extras</SectionLabel>
        <TextField
          label="Notes (optional)"
          value={draft.notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering later"
          multiline
          maxLength={500}
        />
        <ReceiptPicker uri={draft.receiptUri} onChange={setReceipt} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
});
