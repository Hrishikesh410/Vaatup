import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { recordSettlement } from '@/application/settlement-service';
import {
  shareSettlementConfirmation,
  shareSettlementRequest,
} from '@/application/whatsapp-share-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { ChipGroup, type ChipOption } from '@/components/chip-group';
import { MoneyInput } from '@/components/money-input';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { messageFor } from '@/domain/errors';
import { useBalanceOverview, useFriends, useGroups } from '@/hooks/use-data';
import { useRefresh } from '@/state/refresh';
import { useSession } from '@/state/session';
import { spacing, useTheme } from '@/theme/theme';
import { formatMoney } from '@/utils/currency';
import { tapSuccess, tapWarning } from '@/utils/haptics';
import { goBackOrHome } from '@/utils/navigation';

/** Which way the money is moving. */
type Direction = 'theyPay' | 'iPay';

const DIRECTIONS: ChipOption<Direction>[] = [
  { value: 'theyPay', label: 'They paid me' },
  { value: 'iPay', label: 'I paid them' },
];

/**
 * Records a payment between the user and one other person.
 *
 * Recording is the point — the money itself moves in a banking app, and
 * VaatUp only remembers that it did. WhatsApp is offered afterwards so the
 * other person hears about it.
 */
export default function SettleScreen() {
  const { participantId, groupId } = useLocalSearchParams<{
    participantId?: string;
    groupId?: string;
  }>();
  const { colors } = useTheme();
  const { user, self } = useSession();
  const { refresh } = useRefresh();

  const friends = useFriends();
  const groups = useGroups();
  const overview = useBalanceOverview(groupId);

  const [selectedId, setSelectedId] = useState(participantId ?? '');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [direction, setDirection] = useState<Direction>('theyPay');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const other = friends.data.find((friend) => friend.id === selectedId);
  const outstanding =
    overview.data.people.find((person) => person.participant.id === selectedId)?.net ?? 0;
  const groupName = groups.data.find((group) => group.id === groupId)?.name;

  const peopleOptions: ChipOption<string>[] = friends.data.map((friend) => ({
    value: friend.id,
    label: friend.name,
  }));

  // A balance already tells us who is paying whom, so preselect that and let the
  // amount default to clearing it.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && selectedId !== '' && outstanding !== 0) {
    setDirection(outstanding > 0 ? 'theyPay' : 'iPay');
    setAmount(Math.abs(outstanding));
    setSeeded(true);
  }

  const record = async () => {
    if (!user || !self || !other) return;

    setSaving(true);
    setError(null);
    try {
      await recordSettlement(user.id, {
        groupId,
        fromParticipantId: direction === 'theyPay' ? other.id : self.id,
        toParticipantId: direction === 'theyPay' ? self.id : other.id,
        amount,
        currencyCode: 'INR',
        notes: notes.trim() || undefined,
      });
      tapSuccess();
      refresh();
      setRecorded(true);
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not record that payment.'));
    } finally {
      setSaving(false);
    }
  };

  const tellThem = async () => {
    if (!other || !self) return;
    const input = { from: other, to: self, amount, groupId, groupName };
    const result =
      direction === 'theyPay'
        ? await shareSettlementConfirmation(input)
        : await shareSettlementRequest({ ...input, from: self, to: other });

    if (!result.ok) {
      setError(
        result.reason === 'no-phone'
          ? `Add a phone number for ${other.name} to message them.`
          : 'WhatsApp could not be opened on this device.'
      );
    }
  };

  const overpaying = outstanding !== 0 && amount > Math.abs(outstanding);

  return (
    <Screen
      footer={
        recorded ? (
          <>
            <PrimaryButton label="Tell them on WhatsApp" variant="whatsapp" onPress={tellThem} />
            <PrimaryButton label="Done" variant="ghost" onPress={goBackOrHome} />
          </>
        ) : (
          <PrimaryButton
            label={saving ? 'Recording…' : 'Record payment'}
            disabled={saving || !other || amount <= 0}
            onPress={record}
          />
        )
      }
    >
      {friends.data.length === 0 ? (
        <Card>
          <AppText variant="body" muted>
            Nobody saved yet, so there is nothing to settle.
          </AppText>
        </Card>
      ) : (
        <>
          <Card>
            <SectionLabel>Who</SectionLabel>
            <ChipGroup
              options={peopleOptions}
              value={selectedId}
              onChange={(next) => {
                setSelectedId(next);
                setSeeded(false);
                setRecorded(false);
              }}
              accessibilityLabel="Choose a person"
            />
            {other && outstanding !== 0 ? (
              <AppText variant="caption" muted>
                {outstanding > 0
                  ? `${other.name} owes you ${formatMoney(outstanding)}`
                  : `You owe ${other.name} ${formatMoney(-outstanding)}`}
                {groupName ? ` in ${groupName}` : ''}
              </AppText>
            ) : null}
          </Card>

          <Card>
            <SectionLabel>Which way</SectionLabel>
            <ChipGroup
              options={DIRECTIONS}
              value={direction}
              onChange={setDirection}
              fill
              accessibilityLabel="Direction of the payment"
            />
          </Card>

          <Card>
            <SectionLabel>How much</SectionLabel>
            <MoneyInput
              value={amount}
              onChangeValue={(next) => {
                setAmount(next);
                setError(null);
                setRecorded(false);
              }}
              accessibilityLabel="Amount paid"
            />
            {outstanding !== 0 && amount !== Math.abs(outstanding) ? (
              <PrimaryButton
                label={`Settle in full — ${formatMoney(Math.abs(outstanding))}`}
                variant="ghost"
                size="sm"
                onPress={() => setAmount(Math.abs(outstanding))}
              />
            ) : null}
            {overpaying ? (
              <AppText variant="caption" muted>
                That is more than the outstanding balance, so it will leave the other person owed
                money.
              </AppText>
            ) : null}
            <TextField
              label="Note (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="UPI, cash, bank transfer…"
              maxLength={120}
            />
          </Card>
        </>
      )}

      {recorded ? (
        <View style={styles.confirmation}>
          <AppText variant="label" color={colors.accent}>
            Payment recorded
          </AppText>
          <AppText variant="body" muted>
            Balances are up to date. VaatUp never moves money itself — this just records that it
            moved.
          </AppText>
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  confirmation: {
    gap: spacing.xs,
  },
});
