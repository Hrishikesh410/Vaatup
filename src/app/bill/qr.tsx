import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { useBillDraft } from '@/state/bill-draft';
import { loadCollector, type CollectorProfile } from '@/storage/collector';
import { qrColors, radius, spacing } from '@/theme/theme';
import { calculateSplit, shareFor } from '@/utils/calculations';
import { formatMoney } from '@/utils/currency';
import { goBackOrHome } from '@/utils/navigation';
import { buildUpiUri } from '@/utils/upi';

/** Big enough to scan across a table, small enough for a 4-inch screen. */
const QR_SIZE = 240;

export default function QrScreen() {
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { draft, totals } = useBillDraft();

  const [collector, setCollector] = useState<CollectorProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadCollector().then((profile) => {
      setCollector(profile);
      setLoaded(true);
    });
  }, []);

  const { shares } = calculateSplit({
    splitType: draft.splitType,
    total: totals.total,
    people: draft.people,
    exactAmounts: draft.exactAmounts,
    percentages: draft.percentages,
    shareCounts: draft.shareCounts,
  });

  const person = draft.people.find((candidate) => candidate.id === personId);
  const amount = person ? shareFor(shares, person.id) : totals.total;
  const payingFor = person ? person.name : draft.name;

  if (!loaded) return <Screen scroll={false}>{null}</Screen>;

  if (!collector) {
    return (
      <Screen
        footer={<PrimaryButton label="Add UPI ID" onPress={() => router.replace('/settings')} />}
      >
        <Card>
          <AppText variant="body">
            Add your UPI ID and VaatUp can turn any share into a QR code your friends scan to pay
            you the exact amount.
          </AppText>
        </Card>
      </Screen>
    );
  }

  const uri = buildUpiUri({
    collector: { vpa: collector.vpa, name: collector.name },
    amount,
    note: draft.name,
  });

  return (
    <Screen
      scroll={false}
      contentStyle={styles.content}
      footer={<PrimaryButton label="Done" variant="secondary" onPress={goBackOrHome} />}
    >
      <View style={styles.header}>
        <AppText variant="caption" muted>
          {person ? `${payingFor} pays` : 'Scan to pay'}
        </AppText>
        <AppText variant="amount">{formatMoney(amount)}</AppText>
      </View>

      {/* Always light: scanners need the dark-on-light contrast a QR is defined for. */}
      <View style={styles.code}>
        <QRCode
          value={uri}
          size={QR_SIZE}
          backgroundColor={qrColors.surface}
          color={qrColors.ink}
          ecl="M"
        />
      </View>

      <View style={styles.footNote}>
        <AppText variant="label">{collector.vpa}</AppText>
        <AppText variant="caption" muted style={styles.centered}>
          Open any UPI app, scan, and the amount is already filled in.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  code: {
    backgroundColor: qrColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  footNote: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  centered: {
    textAlign: 'center',
  },
});
