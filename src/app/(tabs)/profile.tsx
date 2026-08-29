import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { messageFor } from '@/domain/errors';
import { useBalanceOverview, useExpenses } from '@/hooks/use-data';
import { useSession } from '@/state/session';
import { spacing } from '@/theme/theme';
import { formatMoney } from '@/utils/currency';
import { tapSuccess, tapWarning } from '@/utils/haptics';
import { isValidPhoneNumber } from '@/utils/phone';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, self, signOut, updateProfile } = useSession();
  const overview = useBalanceOverview();
  const expenses = useExpenses();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(self?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed = name.trim() !== (user?.name ?? '') || phone.trim() !== (self?.phone ?? '');
  const phoneUsable = phone.trim() === '' || isValidPhoneNumber(phone);

  const save = async () => {
    setError(null);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      tapSuccess();
      setSaved(true);
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not save your profile.'));
    }
  };

  const confirmSignOut = () => {
    tapWarning();
    Alert.alert('Sign out?', 'Your expenses stay on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const totalSpent = expenses.data.reduce((sum, expense) => sum + expense.totalAmount, 0);

  return (
    <Screen contentStyle={{ paddingTop: insets.top + spacing.xl }}>
      <AppText variant="heading">Profile</AppText>

      <Card>
        <SectionLabel>You</SectionLabel>
        <TextField
          label="Name"
          value={name}
          onChangeText={(next) => {
            setName(next);
            setError(null);
            setSaved(false);
          }}
          placeholder="Your name"
          autoCapitalize="words"
          maxLength={40}
        />
        <TextField
          label="Phone (optional)"
          value={phone}
          onChangeText={(next) => {
            setPhone(next);
            setError(null);
            setSaved(false);
          }}
          placeholder="9876543210"
          keyboardType="phone-pad"
          hint="Only used to prefill WhatsApp, never sent anywhere."
          error={error ?? (phoneUsable ? undefined : 'That number does not look right.')}
        />
        {user?.email ? (
          <AppText variant="caption" muted>
            Signed in as {user.email}
          </AppText>
        ) : null}
        <PrimaryButton
          label={saved && !changed ? 'Saved' : 'Save'}
          variant="secondary"
          disabled={!changed || name.trim() === '' || !phoneUsable}
          onPress={save}
        />
      </Card>

      <Card>
        <SectionLabel>Your numbers</SectionLabel>
        <View style={styles.statRow}>
          <AppText variant="body" muted>
            Expenses recorded
          </AppText>
          <AppText variant="label">{expenses.data.length}</AppText>
        </View>
        <View style={styles.statRow}>
          <AppText variant="body" muted>
            Total value
          </AppText>
          <AppText variant="label">{formatMoney(totalSpent)}</AppText>
        </View>
        <View style={styles.statRow}>
          <AppText variant="body" muted>
            Owed to you
          </AppText>
          <AppText variant="label">{formatMoney(overview.data.owed)}</AppText>
        </View>
        <View style={styles.statRow}>
          <AppText variant="body" muted>
            You owe
          </AppText>
          <AppText variant="label">{formatMoney(overview.data.owes)}</AppText>
        </View>
      </Card>

      <Card>
        <SectionLabel>Settings</SectionLabel>
        <PrimaryButton
          label="Payment details"
          variant="secondary"
          onPress={() => router.push('/settings')}
        />
        <PrimaryButton
          label="Repeating expenses"
          variant="secondary"
          onPress={() => router.push('/recurring')}
        />
        <PrimaryButton label="Sign out" variant="ghost" onPress={confirmSignOut} />
      </Card>

      <AppText variant="caption" muted style={styles.note}>
        Everything lives on this device. VaatUp has no account server and never moves money.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  note: {
    textAlign: 'center',
  },
});
