import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { spacing } from '@/theme/theme';

/** Catches a bad deep link so the app never strands the user on a blank screen. */
export default function NotFoundScreen() {
  return (
    <Screen footer={<PrimaryButton label="Go home" onPress={() => router.replace('/')} />}>
      <View style={styles.block}>
        <AppText variant="heading">That screen doesn&apos;t exist</AppText>
        <AppText variant="body" muted>
          The link you followed points somewhere VaatUp doesn&apos;t have.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
});
