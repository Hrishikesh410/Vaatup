import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { MoneyInput } from '@/components/money-input';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useBillDraft } from '@/state/bill-draft';
import { useSession } from '@/state/session';
import { markOnboardingFinished } from '@/storage/onboarding';
import { spacing } from '@/theme/theme';
import { validateBillAmount } from '@/utils/validation';

/**
 * The first thing a new account sees.
 *
 * There is nothing to look at until a bill exists, so this is the opening step
 * of the real create flow — the amount and what it was for — under a sentence
 * of context, rather than a carousel of promises. What the user types is the
 * same draft the rest of the flow picks up, so they come out of it with an
 * actual expense.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { draft, setBase, setName } = useBillDraft();
  const [leaving, setLeaving] = useState(false);

  const amountCheck = validateBillAmount(draft.base === 0 ? null : draft.base);

  /**
   * The flag is written before navigating rather than once the split is saved.
   * The tabs redirect here until it is set, so awaiting the write is what stops
   * the user bouncing straight back; anyone who stops halfway meets the home
   * screen's empty state, which says much the same thing.
   */
  const finishThen = async (go: () => void) => {
    setLeaving(true);
    try {
      if (user) await markOnboardingFinished(user.id);
      go();
    } finally {
      // Coming back to this screen from the next step must not find dead buttons.
      setLeaving(false);
    }
  };

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + spacing.xxl }}
      footer={
        <>
          {amountCheck.valid ? null : (
            <AppText variant="caption" muted>
              {amountCheck.message}
            </AppText>
          )}
          <PrimaryButton
            label="Add people"
            disabled={leaving || !amountCheck.valid}
            onPress={() => void finishThen(() => router.push('/bill/people'))}
          />
          <PrimaryButton
            label="Skip for now"
            variant="ghost"
            disabled={leaving}
            onPress={() => void finishThen(() => router.replace('/(tabs)'))}
          />
        </>
      }
    >
      <View style={styles.hero}>
        <AppText variant="display">Split your first bill</AppText>
        <AppText variant="body" muted>
          Start with what the bill came to. You add the people next, pick how to split it, and send
          everyone their share on WhatsApp.
        </AppText>
      </View>

      <MoneyInput
        value={draft.base}
        onChangeValue={setBase}
        size="hero"
        accessibilityLabel="Total bill amount"
      />

      <TextField
        label="Bill name (optional)"
        value={draft.name}
        onChangeText={setName}
        placeholder="Dinner at ABC Restaurant"
        returnKeyType="done"
        maxLength={60}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
});
