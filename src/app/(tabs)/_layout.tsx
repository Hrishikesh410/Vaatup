import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboardingStatus } from '@/hooks/use-onboarding';
import { borderWidth, control, typography, useTheme } from '@/theme/theme';

/**
 * The five places the app lives in: what you owe, what you have spent, who you
 * split with, and your own settings. Adding an expense is a pushed flow rather
 * than a tab, because it has a beginning and an end.
 *
 * Labels without icons, in keeping with the rest of the app's text-first look.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const onboarding = useOnboardingStatus();

  // Nothing is drawn while the answer is unknown. Showing the tabs and then
  // replacing them reads as a flicker on the one launch it would happen.
  if (onboarding === 'unknown') return null;

  if (onboarding === 'needed') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: borderWidth.hairline,
          // A fixed height replaces the inset-aware one the navigator would have
          // worked out, so the bottom inset has to be added back. Without it the
          // labels sit under Android's gesture bar.
          height: control.row + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: typography.caption.fontWeight,
        },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="friends" options={{ title: 'People' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
