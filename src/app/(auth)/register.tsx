import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { messageFor } from '@/domain/errors';
import { useSession } from '@/state/session';
import { spacing, useTheme } from '@/theme/theme';
import { tapSuccess, tapWarning } from '@/utils/haptics';
import { validateEmail, validatePassword } from '@/utils/password';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailCheck = validateEmail(email);
  const passwordCheck = validatePassword(password);
  const ready = name.trim() !== '' && emailCheck.valid && passwordCheck.valid;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signUp({ name, email, password });
      tapSuccess();
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not create that account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + spacing.xxl }}
      footer={
        <PrimaryButton
          label={busy ? 'Creating…' : 'Create account'}
          disabled={busy || !ready}
          onPress={submit}
        />
      }
    >
      <View style={styles.hero}>
        <AppText variant="display">Get started</AppText>
        <AppText variant="body" muted>
          Your name is what your friends see on every split you send them.
        </AppText>
      </View>

      <Card>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Hrishikesh"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          maxLength={40}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setError(null);
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          // Only complain once there is something worth complaining about.
          error={email.trim() === '' || emailCheck.valid ? undefined : emailCheck.message}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            setError(null);
          }}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={submit}
          returnKeyType="done"
          hint="Kept on this device only."
          error={
            error ?? (password === '' || passwordCheck.valid ? undefined : passwordCheck.message)
          }
        />
      </Card>

      <View style={styles.switcher}>
        <AppText variant="body" muted>
          Already have an account?
        </AppText>
        <Link href="/(auth)/login" asChild>
          <AppText variant="body" weight="600" color={colors.accent}>
            Sign in
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
