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

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password });
      tapSuccess();
      // The gate in the root layout moves us on once the session lands.
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not sign you in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + spacing.xxl }}
      footer={
        <PrimaryButton
          label={busy ? 'Signing in…' : 'Sign in'}
          disabled={busy || email.trim() === '' || password === ''}
          onPress={submit}
        />
      }
    >
      <View style={styles.hero}>
        <AppText variant="display">VaatUp</AppText>
        <AppText variant="body" muted>
          Split a bill. Send the amounts. Done.
        </AppText>
      </View>

      <Card>
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
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            setError(null);
          }}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          onSubmitEditing={submit}
          returnKeyType="done"
          error={error ?? undefined}
        />
      </Card>

      <View style={styles.switcher}>
        <AppText variant="body" muted>
          New here?
        </AppText>
        <Link href="/(auth)/register" asChild>
          <AppText variant="body" weight="600" color={colors.accent}>
            Create an account
          </AppText>
        </Link>
      </View>

      <AppText variant="caption" muted style={styles.note}>
        Your account and every split stay on this device. VaatUp has no server to send them to.
      </AppText>
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
  note: {
    textAlign: 'center',
  },
});
