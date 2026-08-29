import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { ChipGroup, type ChipOption } from '@/components/chip-group';
import { MoneyInput } from '@/components/money-input';
import { PayerPicker } from '@/components/payer-picker';
import { PercentInput } from '@/components/percent-input';
import { PersonRow } from '@/components/person-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ShareStepper } from '@/components/share-stepper';
import { useBillDraft } from '@/state/bill-draft';
import { useRefresh } from '@/state/refresh';
import { spacing, useTheme } from '@/theme/theme';
import { messageFor } from '@/domain/errors';
import { SPLIT_TYPES, type SplitType } from '@/types/split';
import { calculateSplit, shareFor } from '@/utils/calculations';
import { formatMoney } from '@/utils/currency';
import { tapWarning } from '@/utils/haptics';
import { SPLIT_TYPE_CHIP_LABELS } from '@/utils/split-labels';
import { validatePayers, validateSplit } from '@/utils/validation';

const SPLIT_TYPE_OPTIONS: ChipOption<SplitType>[] = SPLIT_TYPES.map((splitType) => ({
  value: splitType,
  label: SPLIT_TYPE_CHIP_LABELS[splitType],
}));

export default function SplitScreen() {
  const { colors } = useTheme();
  const { refresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    draft,
    totals,
    payers,
    setSplitType,
    setExactAmount,
    setPercentage,
    setShareCount,
    resetToEqual,
    ensureDefaults,
    commit,
  } = useBillDraft();

  // Fills in equal amounts/percentages/shares when arriving here, or after the
  // roster changed.
  useEffect(() => {
    ensureDefaults();
  }, [ensureDefaults]);

  const splitInput = {
    splitType: draft.splitType,
    total: totals.total,
    people: draft.people,
    exactAmounts: draft.exactAmounts,
    percentages: draft.percentages,
    shareCounts: draft.shareCounts,
  };

  const validation = validateSplit(splitInput);
  const payerCheck = validatePayers(payers, totals.total);
  const preview = calculateSplit(splitInput);
  const amounts = preview.shares.map((share) => share.amount);
  const lowest = amounts.length > 0 ? Math.min(...amounts) : 0;
  const highest = amounts.length > 0 ? Math.max(...amounts) : 0;
  const uneven = lowest !== highest;
  const ready = validation.valid && payerCheck.valid;

  const handleReview = async () => {
    setSaving(true);
    setError(null);
    try {
      const expense = await commit();
      refresh();
      // navigate, not push: coming back here from an existing review must not
      // stack a second review screen behind the back button.
      router.navigate({ pathname: '/bill/result', params: { id: expense.id } });
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not save that split.'));
    } finally {
      setSaving(false);
    }
  };

  const problem = error ?? (!validation.valid ? validation.message : payerCheck.message);

  return (
    <Screen
      footer={
        <>
          {ready && !error ? (
            <View style={styles.footerRow}>
              <AppText variant="body" muted>
                Total
              </AppText>
              <AppText variant="label">{formatMoney(totals.total)}</AppText>
            </View>
          ) : (
            <View style={styles.footerRow}>
              <AppText variant="caption" color={colors.danger} weight="600">
                {problem}
              </AppText>
              {validation.remaining !== undefined && validation.remaining !== 0 ? (
                <AppText variant="caption" color={colors.danger} weight="600">
                  {validation.remaining > 0
                    ? `Remaining: ${formatMoney(validation.remaining)}`
                    : `Over by ${formatMoney(-validation.remaining)}`}
                </AppText>
              ) : null}
              {validation.percentTotal !== undefined ? (
                <AppText variant="caption" color={colors.danger} weight="600">
                  Now: {Math.round(validation.percentTotal * 100) / 100}%
                </AppText>
              ) : null}
            </View>
          )}
          <PrimaryButton
            label={saving ? 'Saving…' : 'Review split'}
            disabled={!ready || saving}
            onPress={handleReview}
          />
        </>
      }
    >
      <PayerPicker />

      <ChipGroup
        options={SPLIT_TYPE_OPTIONS}
        value={draft.splitType}
        onChange={setSplitType}
        fill
      />

      {draft.splitType === 'equal' ? (
        <Card>
          <SectionLabel>{uneven ? 'Everyone pays about' : 'Everyone pays'}</SectionLabel>
          <AppText variant="amount">{formatMoney(highest)}</AppText>
          <AppText variant="caption" muted>
            {uneven
              ? `Some pay ${formatMoney(lowest)} so the total lands exactly on ${formatMoney(totals.total)}.`
              : `${draft.people.length} ${draft.people.length === 1 ? 'person' : 'people'} · ${formatMoney(totals.total)} total`}
          </AppText>
        </Card>
      ) : null}

      <Card>
        <View style={styles.cardHeader}>
          <SectionLabel>People</SectionLabel>
          {draft.splitType !== 'equal' ? (
            <PrimaryButton
              label="Reset to equal"
              variant="ghost"
              size="sm"
              onPress={resetToEqual}
            />
          ) : null}
        </View>

        {draft.people.map((person) => {
          const amount = shareFor(preview.shares, person.id);

          if (draft.splitType === 'exact') {
            return (
              <PersonRow
                key={person.id}
                name={person.name}
                right={
                  <MoneyInput
                    value={draft.exactAmounts[person.id] ?? 0}
                    onChangeValue={(value) => setExactAmount(person.id, value)}
                    accessibilityLabel={`Amount for ${person.name}`}
                  />
                }
              />
            );
          }

          if (draft.splitType === 'percentage') {
            return (
              <PersonRow
                key={person.id}
                name={person.name}
                subtitle={formatMoney(amount)}
                right={
                  <PercentInput
                    value={draft.percentages[person.id] ?? 0}
                    onChangeValue={(value) => setPercentage(person.id, value)}
                    accessibilityLabel={`Percentage for ${person.name}`}
                  />
                }
              />
            );
          }

          if (draft.splitType === 'shares') {
            return (
              <PersonRow
                key={person.id}
                name={person.name}
                subtitle={formatMoney(amount)}
                right={
                  <ShareStepper
                    value={draft.shareCounts[person.id] ?? 0}
                    onChangeValue={(value) => setShareCount(person.id, value)}
                    personName={person.name}
                  />
                }
              />
            );
          }

          return (
            <PersonRow
              key={person.id}
              name={person.name}
              right={<AppText variant="label">{formatMoney(amount)}</AppText>}
            />
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
