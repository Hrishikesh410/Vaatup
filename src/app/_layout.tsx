import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { HeaderBackButton } from '@/components/header-back-button';
import { BillDraftProvider } from '@/state/bill-draft';
import { RefreshProvider } from '@/state/refresh';
import { SessionProvider, useSession } from '@/state/session';
import { typography, useTheme } from '@/theme/theme';

export default function RootLayout() {
  const { dark } = useTheme();

  return (
    // Outermost, because every screen's keyboard handling reads from it.
    <KeyboardProvider>
      <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
        {/* Session first: the draft and every data hook read from it. */}
        <SessionProvider>
          <RefreshProvider>
            <BillDraftProvider>
              <StatusBar style={dark ? 'light' : 'dark'} />
              <AuthGate />
              <AppStack />
            </BillDraftProvider>
          </RefreshProvider>
        </SessionProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}

/**
 * Keeps the route in step with the session.
 *
 * A signed-out user is sent to the sign-in screens, and a signed-in user is
 * sent out of them. Doing this in one place means no individual screen has to
 * check, and a deep link into an app screen still lands on sign-in first.
 */
function AuthGate() {
  const { status } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    const inAuthFlow = segments[0] === '(auth)';
    if (status === 'signedOut' && !inAuthFlow) {
      router.replace('/(auth)/login');
    } else if (status === 'signedIn' && inAuthFlow) {
      router.replace('/(tabs)');
    }
  }, [status, segments, router]);

  return null;
}

function AppStack() {
  const { colors } = useTheme();
  const { status } = useSession();

  // Opening the database and restoring the session takes a moment on a cold
  // start. Rendering the stack before it finishes would flash the sign-in
  // screen at someone who is already signed in.
  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerTitleStyle: {
          fontSize: typography.label.fontSize,
          fontWeight: typography.label.fontWeight,
        },
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        // Same labelled back control on both platforms, instead of iOS's
        // previous-title label and Android's unlabelled arrow.
        headerBackVisible: false,
        headerLeft: () => <HeaderBackButton />,
        // iOS-only option: keeps swipe-from-edge working alongside the
        // custom headerLeft. Android goes back with the system gesture.
        gestureEnabled: true,
        // Android's default is a fade; a push matches the forward motion of
        // the create → people → split → review flow.
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Its own heading carries the screen, and there is nothing to go back to. */}
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="bill/create" options={{ title: 'New expense' }} />
      <Stack.Screen name="bill/people" options={{ title: 'People' }} />
      <Stack.Screen name="bill/split" options={{ title: 'Split' }} />
      <Stack.Screen name="bill/result" options={{ title: 'Review & send' }} />
      <Stack.Screen name="expense/[id]" options={{ title: 'Expense' }} />
      <Stack.Screen name="group/new" options={{ title: 'New group' }} />
      <Stack.Screen name="group/[id]" options={{ title: 'Group' }} />
      <Stack.Screen name="friend/edit" options={{ title: 'Person' }} />
      <Stack.Screen name="balances" options={{ title: 'Balances' }} />
      <Stack.Screen name="settle" options={{ title: 'Settle up' }} />
      <Stack.Screen name="recurring" options={{ title: 'Repeating' }} />
      <Stack.Screen name="settings" options={{ title: 'Payment details' }} />
      <Stack.Screen
        name="bill/qr"
        options={{
          title: 'Scan to pay',
          presentation: 'modal',
          // A modal is dismissed, not navigated back from.
          headerLeft: () => <HeaderBackButton label="Close" />,
        }}
      />
      <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
