import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  clearCollector,
  loadCollector,
  saveCollector,
  type CollectorProfile,
} from '@/storage/collector';
import { spacing, useTheme } from '@/theme/theme';
import { tapSuccess, tapWarning } from '@/utils/haptics';
import { goBackOrHome } from '@/utils/navigation';
import { isValidVpa, normalizeVpa } from '@/utils/upi';

export default function SettingsScreen() {
  const { colors } = useTheme();

  const [vpa, setVpa] = useState('');
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState<CollectorProfile | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadCollector().then((profile) => {
      if (!profile) return;
      setSaved(profile);
      setVpa(profile.vpa);
      setName(profile.name);
      setEnabled(profile.enabled);
    });
  }, []);

  const save = async () => {
    if (!isValidVpa(vpa)) {
      setError('Enter a UPI ID like name@bank.');
      tapWarning();
      return;
    }

    setError(undefined);
    const profile: CollectorProfile = {
      vpa: normalizeVpa(vpa),
      name: name.trim(),
      enabled,
    };
    await saveCollector(profile);
    setSaved(profile);
    tapSuccess();
    goBackOrHome();
  };

  const remove = async () => {
    await clearCollector();
    setSaved(null);
    setVpa('');
    setName('');
    setEnabled(true);
    setError(undefined);
    tapSuccess();
  };

  return (
    <Screen
      footer={
        <>
          <PrimaryButton label="Save" onPress={save} />
          {saved ? (
            <PrimaryButton
              label="Remove UPI ID"
              variant="ghost"
              onPress={remove}
              accessibilityHint="Deletes your UPI ID from this device"
            />
          ) : null}
        </>
      }
    >
      <Card>
        <SectionLabel>Collect with UPI</SectionLabel>
        <AppText variant="body" muted>
          Add your UPI ID and VaatUp can ask for each share by name and exact amount — in the
          WhatsApp message, or as a QR code your friends scan at the table.
        </AppText>
      </Card>

      <TextField
        label="Your UPI ID"
        value={vpa}
        onChangeText={(value) => {
          setVpa(value);
          // Keeping a stale error next to a corrected field reads as a bug.
          if (error) setError(undefined);
        }}
        placeholder="name@bank"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        error={error}
        hint="Find it in your UPI app, e.g. 9876543210@ybl or asha@okhdfcbank."
      />

      <TextField
        label="Name shown to payers (optional)"
        value={name}
        onChangeText={setName}
        placeholder="Asha"
        autoCapitalize="words"
        maxLength={50}
        hint="Their UPI app shows this next to the amount."
      />

      <Card>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <AppText variant="label">Include in messages</AppText>
            <AppText variant="caption" muted>
              Adds one line asking each person to pay their share to this UPI ID.
            </AppText>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ true: colors.accent, false: colors.surfaceStrong }}
            accessibilityLabel="Include my UPI ID in messages"
          />
        </View>
      </Card>

      <AppText variant="caption" muted style={styles.note}>
        Your UPI ID stays on this phone. VaatUp has no account and no server, and never moves money
        — payment happens inside your friend&apos;s own UPI app.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    gap: spacing.xs,
  },
  note: {
    textAlign: 'center',
  },
});
