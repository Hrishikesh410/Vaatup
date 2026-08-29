import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PrimaryButton } from '@/components/primary-button';
import { radius, spacing, useTheme } from '@/theme/theme';
import { tapSelection, tapWarning } from '@/utils/haptics';
import { deleteReceipt, storeReceipt } from '@/utils/receipts';

export interface ReceiptPickerProps {
  uri?: string;
  onChange: (uri?: string) => void;
}

/**
 * Attaches a photo of the receipt to an expense.
 *
 * The photo library is used rather than the camera: the system picker needs no
 * permission of its own, which keeps VaatUp's promise of asking for nothing
 * at runtime. A picked photo is copied into the app's own storage so it does not
 * disappear when the system clears its caches.
 */
export function ReceiptPicker({ uri, onChange }: ReceiptPickerProps) {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const pick = async () => {
    setError(null);
    tapSelection();

    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: false,
      });
      if (picked.canceled || !picked.assets[0]) return;

      setWorking(true);
      const stored = await storeReceipt(picked.assets[0].uri);
      if (uri) await deleteReceipt(uri);
      onChange(stored);
    } catch {
      tapWarning();
      setError('Could not attach that photo.');
    } finally {
      setWorking(false);
    }
  };

  const clear = async () => {
    if (uri) await deleteReceipt(uri);
    onChange(undefined);
  };

  return (
    <View style={styles.container}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.preview, { backgroundColor: colors.surfaceStrong }]}
          resizeMode="cover"
          accessibilityLabel="Attached receipt"
        />
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={working ? 'Attaching…' : uri ? 'Replace receipt' : 'Attach receipt'}
          variant="secondary"
          size="sm"
          disabled={working}
          onPress={pick}
        />
        {uri ? (
          <PrimaryButton
            label="Remove"
            variant="ghost"
            size="sm"
            tone="danger"
            onPress={clear}
            accessibilityLabel="Remove the attached receipt"
          />
        ) : null}
      </View>

      <AppText variant="caption" color={error ? colors.danger : colors.textMuted}>
        {error ?? 'Stays on this device, like everything else.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
