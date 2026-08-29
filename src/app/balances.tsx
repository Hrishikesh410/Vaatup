import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BalanceHeadline } from '@/components/balance-headline';
import { Card, SectionLabel } from '@/components/card';
import { PersonRow } from '@/components/person-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { useBalanceOverview, useSettlementSuggestions } from '@/hooks/use-data';
import { useSession } from '@/state/session';
import { spacing } from '@/theme/theme';
import { formatMoney } from '@/utils/currency';

/**
 * Every outstanding balance in one place, plus the shortest way to clear them.
 *
 * The suggestions come from the debt simplification service: in a group of four
 * who all owe each other something, it is usually two payments rather than six.
 */
export default function BalancesScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { self } = useSession();

  const overview = useBalanceOverview(groupId);
  const suggestions = useSettlementSuggestions(groupId);

  const nameFor = (participantId: string) => {
    if (participantId === self?.id) return 'You';
    return (
      overview.data.people.find((person) => person.participant.id === participantId)?.participant
        .name ?? 'Someone'
    );
  };

  const worthSimplifying = suggestions.data.length > 0 && overview.data.people.length > 1;

  return (
    <Screen>
      <BalanceHeadline owed={overview.data.owed} owes={overview.data.owes} />

      {overview.data.people.length === 0 ? (
        overview.loading ? null : (
          <Card>
            <AppText variant="body" muted>
              Nothing outstanding. Everyone is square.
            </AppText>
          </Card>
        )
      ) : (
        <Card>
          <SectionLabel>Person by person</SectionLabel>
          {overview.data.people.map(({ participant, net }) => (
            <PersonRow
              key={participant.id}
              name={participant.name}
              subtitle={net > 0 ? 'Owes you' : 'You owe'}
              subtitleTone={net > 0 ? 'accent' : 'danger'}
              right={<AppText variant="label">{formatMoney(Math.abs(net))}</AppText>}
              below={
                <PrimaryButton
                  label="Settle up"
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: '/settle',
                      params: { participantId: participant.id, groupId },
                    })
                  }
                  accessibilityLabel={`Settle up with ${participant.name}`}
                  style={styles.settleButton}
                />
              }
            />
          ))}
        </Card>
      )}

      {worthSimplifying ? (
        <Card>
          <SectionLabel>Fewest payments</SectionLabel>
          <AppText variant="caption" muted>
            Clearing everything takes {suggestions.data.length}{' '}
            {suggestions.data.length === 1 ? 'payment' : 'payments'}.
          </AppText>
          {suggestions.data.map((suggestion) => (
            <View
              key={`${suggestion.fromParticipantId}-${suggestion.toParticipantId}`}
              style={styles.line}
            >
              <AppText variant="body" numberOfLines={1} style={styles.lineName}>
                {nameFor(suggestion.fromParticipantId)} pays {nameFor(suggestion.toParticipantId)}
              </AppText>
              <AppText variant="label">{formatMoney(suggestion.amount)}</AppText>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  lineName: {
    flex: 1,
  },
  settleButton: {
    alignSelf: 'flex-start',
  },
});
