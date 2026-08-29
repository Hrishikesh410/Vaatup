import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { shareBillSummary, shareBillWithPerson } from '@/application/whatsapp-share-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PersonRow } from '@/components/person-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SplitSummary } from '@/components/split-summary';
import { useBillDraft } from '@/state/bill-draft';
import { useRefresh } from '@/state/refresh';
import { loadCollector, type CollectorProfile } from '@/storage/collector';
import { opacity, spacing, useTheme } from '@/theme/theme';
import type { Person } from '@/types/person';
import { calculateSplit, shareFor } from '@/utils/calculations';
import { formatMoney } from '@/utils/currency';
import { tapImpact, tapSuccess, tapWarning } from '@/utils/haptics';
import { isPaid, paidStatus } from '@/utils/paid';
import { isValidPhoneNumber } from '@/utils/phone';
import { shareText } from '@/utils/sharing';
import { billTitle, type SplitMessageContext } from '@/utils/whatsapp';

export default function ResultScreen() {
  const { colors } = useTheme();
  const { refresh } = useRefresh();
  const { draft, totals, payers, togglePaid, setAllPaid } = useBillDraft();
  const [messaged, setMessaged] = useState<string[]>([]);
  const [collector, setCollector] = useState<CollectorProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCollector().then((profile) => {
        if (active) setCollector(profile);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const { shares } = calculateSplit({
    splitType: draft.splitType,
    total: totals.total,
    people: draft.people,
    exactAmounts: draft.exactAmounts,
    percentages: draft.percentages,
    shareCounts: draft.shareCounts,
  });

  const collecting = collector !== null && collector.enabled;

  // The share service attaches payment details, so this is only the bill.
  const context: Omit<SplitMessageContext, 'collector'> = {
    billName: draft.name,
    totals,
    people: draft.people,
    shares,
    paid: draft.paid,
  };

  const payerNames = payers
    .map(
      (payer) => draft.people.find((person) => person.id === payer.participantId)?.name ?? 'Someone'
    )
    .join(', ');

  const status = paidStatus(draft.people, shares, draft.paid);
  const reachable = draft.people.filter((person) => isValidPhoneNumber(person.phone));
  // Nobody who has already settled up should be chased for their share.
  const owing = reachable.filter((person) => !isPaid(draft.paid, person.id));
  const pending = owing.filter((person) => !messaged.includes(person.id));

  const goToPeople = () => router.navigate('/bill/people');

  const send = async (person: Person) => {
    tapImpact();
    const { result, message } = await shareBillWithPerson(context, person);

    if (result.ok) {
      setMessaged((current) => (current.includes(person.id) ? current : [...current, person.id]));
      return;
    }

    tapWarning();

    if (result.reason === 'no-phone' || result.reason === 'invalid-phone') {
      Alert.alert(
        `${person.name} needs a phone number`,
        result.reason === 'no-phone'
          ? 'Add a number to send their share on WhatsApp.'
          : "That number doesn't look right. Check it and try again.",
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Add number', onPress: goToPeople },
        ]
      );
      return;
    }

    Alert.alert(
      "Couldn't open WhatsApp",
      'WhatsApp may not be installed on this device. You can send the message another way instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share instead', onPress: () => shareText(message) },
      ]
    );
  };

  const sendAllLabel = () => {
    if (reachable.length === 0) return 'Send on WhatsApp';
    if (owing.length === 0) return 'Everyone has paid';
    if (pending.length === 0) return 'All messages opened';
    if (messaged.length === 0) {
      return owing.length === 1
        ? `Send on WhatsApp · ${owing[0].name}`
        : `Send on WhatsApp (${owing.length})`;
    }
    return `Send next · ${pending[0].name}`;
  };

  return (
    <>
      {/* Finishing has to stay reachable without scrolling on short screens. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.dismissTo('/')}
              accessibilityRole="button"
              accessibilityLabel="Done"
              accessibilityHint="Closes this split and returns home"
              hitSlop={12}
              style={({ pressed }) => [styles.headerAction, pressed ? styles.pressed : null]}
            >
              <AppText variant="label" color={colors.accent}>
                Done
              </AppText>
            </Pressable>
          ),
        }}
      />
      <Screen
        footer={
          <>
            {draft.people.length > 0 ? (
              <View style={styles.footerStatus}>
                <AppText variant="caption" muted>
                  {status.settled
                    ? 'Everyone has paid'
                    : `${status.paidCount} of ${status.peopleCount} paid`}
                </AppText>
                <AppText
                  variant="caption"
                  weight="600"
                  color={status.settled ? colors.accent : undefined}
                  muted={!status.settled}
                >
                  {status.settled
                    ? `${formatMoney(status.collected)} collected`
                    : `${formatMoney(status.outstanding)} left to collect`}
                </AppText>
              </View>
            ) : null}
            {reachable.length === 0 ? (
              <AppText variant="caption" muted>
                Add a phone number to send shares on WhatsApp.
              </AppText>
            ) : null}
            <PrimaryButton
              label={sendAllLabel()}
              variant="whatsapp"
              disabled={reachable.length === 0 || pending.length === 0}
              onPress={() => {
                if (pending[0]) send(pending[0]);
              }}
              accessibilityHint="Opens WhatsApp with the message ready. You still press send there."
            />
            <View style={styles.footerRow}>
              <PrimaryButton
                label="Share summary"
                variant="secondary"
                onPress={() => shareBillSummary(context)}
                style={styles.grow}
              />
              <PrimaryButton
                label="Edit split"
                variant="ghost"
                onPress={() => router.navigate('/bill/split')}
                style={styles.grow}
              />
            </View>
          </>
        }
      >
        <View style={styles.hero}>
          <AppText variant="caption" muted numberOfLines={1}>
            {billTitle(draft.name)}
          </AppText>
          <AppText variant="amount">{formatMoney(totals.total)}</AppText>
        </View>

        <Card>
          <SplitSummary totals={totals} />
          {payerNames ? (
            <AppText variant="caption" muted>
              Paid by {payerNames}
            </AppText>
          ) : null}
        </Card>

        <Card>
          <View style={styles.cardHeader}>
            <SectionLabel>People</SectionLabel>
            {draft.people.length > 1 ? (
              <PrimaryButton
                label={status.settled ? 'Clear paid' : 'Mark all paid'}
                variant="ghost"
                size="sm"
                onPress={() => {
                  tapSuccess();
                  setAllPaid(!status.settled);
                  refresh();
                }}
              />
            ) : null}
          </View>
          {draft.people.map((person) => {
            const paid = isPaid(draft.paid, person.id);
            const sent = messaged.includes(person.id);
            const hasPhone = isValidPhoneNumber(person.phone);

            const subtitle = paid
              ? 'Paid'
              : sent
                ? 'Opened in WhatsApp'
                : hasPhone
                  ? person.phone
                  : 'No phone number';

            return (
              <PersonRow
                key={person.id}
                name={person.name}
                struck={paid}
                subtitle={subtitle}
                subtitleTone={paid ? 'accent' : hasPhone || sent ? 'muted' : 'danger'}
                right={
                  <AppText variant="label" strikethrough={paid} muted={paid}>
                    {formatMoney(shareFor(shares, person.id))}
                  </AppText>
                }
                // Actions go under the name: two buttons on the same line as the
                // name squeeze it and truncate longer phone numbers.
                below={
                  <View style={styles.personActions}>
                    {/* Chasing someone who has already settled up is just noise. */}
                    {paid ? null : (
                      <PrimaryButton
                        label={sent ? 'Send again' : hasPhone ? 'WhatsApp' : 'Add phone'}
                        variant={hasPhone ? 'whatsapp' : 'ghost'}
                        size="sm"
                        onPress={() => (hasPhone ? send(person) : goToPeople())}
                        accessibilityLabel={
                          hasPhone
                            ? `Send ${person.name}'s share on WhatsApp`
                            : `Add a phone number for ${person.name}`
                        }
                        accessibilityHint={
                          hasPhone ? `Opens WhatsApp with ${person.name}'s share` : undefined
                        }
                        style={styles.grow}
                      />
                    )}
                    {/* A QR is the one payment route that needs no phone number. */}
                    {collecting && !paid ? (
                      <PrimaryButton
                        label="QR"
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          router.push({
                            pathname: '/bill/qr',
                            params: { personId: person.id },
                          })
                        }
                        accessibilityLabel={`Show a UPI QR code for ${person.name}'s share`}
                        accessibilityHint="Opens a code they can scan to pay you"
                      />
                    ) : null}
                    <PrimaryButton
                      label={paid ? '✓ Paid' : 'Mark paid'}
                      variant={paid ? 'accent' : 'ghost'}
                      size="sm"
                      onPress={() => {
                        tapSuccess();
                        togglePaid(person.id);
                        refresh();
                      }}
                      accessibilityLabel={
                        paid ? `${person.name} has paid` : `Mark ${person.name} as paid`
                      }
                      accessibilityHint={
                        paid ? 'Marks them as not paid again' : 'Crosses their share off the split'
                      }
                    />
                  </View>
                }
              />
            );
          })}
        </Card>

        <AppText variant="caption" muted style={styles.disclaimer}>
          VaatUp opens WhatsApp with the message filled in. You review it and press send.
        </AppText>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  disclaimer: {
    textAlign: 'center',
  },
  headerAction: {
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: opacity.muted,
  },
});
