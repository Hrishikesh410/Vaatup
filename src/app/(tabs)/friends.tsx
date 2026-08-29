import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { removeFriend } from '@/application/people-service';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { PersonRow } from '@/components/person-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useBalanceOverview, useFriends } from '@/hooks/use-data';
import { useRefresh } from '@/state/refresh';
import { spacing } from '@/theme/theme';
import type { Participant } from '@/types/participant';
import { formatMoney } from '@/utils/currency';
import { tapWarning } from '@/utils/haptics';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { refresh } = useRefresh();
  const friends = useFriends();
  const overview = useBalanceOverview();
  const [search, setSearch] = useState('');

  const term = search.trim().toLowerCase();
  const visible =
    term === ''
      ? friends.data
      : friends.data.filter(
          (friend) =>
            friend.name.toLowerCase().includes(term) || (friend.phone ?? '').includes(term)
        );

  const balanceFor = (friend: Participant) =>
    overview.data.people.find((person) => person.participant.id === friend.id)?.net ?? 0;

  const subtitleFor = (friend: Participant) => {
    const net = balanceFor(friend);
    if (net > 0) return `Owes you ${formatMoney(net)}`;
    if (net < 0) return `You owe ${formatMoney(-net)}`;
    return friend.phone ?? 'No phone number';
  };

  const confirmRemove = (friend: Participant) => {
    tapWarning();
    Alert.alert(
      `Remove ${friend.name}?`,
      'They stay on every expense they are already part of — this only takes them off your list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFriend(friend.id);
            refresh();
          },
        },
      ]
    );
  };

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + spacing.xl }}
      footer={
        <PrimaryButton label="Add a person" icon="+" onPress={() => router.push('/friend/edit')} />
      }
    >
      <AppText variant="heading">People</AppText>
      <AppText variant="body" muted>
        Nobody here needs VaatUp installed. A name is enough; a phone number lets you send them
        their share.
      </AppText>

      {friends.data.length > 3 ? (
        <TextField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Name or number"
          autoCapitalize="none"
        />
      ) : null}

      {visible.length === 0 ? (
        friends.loading ? null : (
          <Card>
            <AppText variant="body" muted>
              {friends.data.length === 0
                ? 'No one saved yet. Anyone you split with gets saved here automatically.'
                : 'Nobody matches that search.'}
            </AppText>
          </Card>
        )
      ) : (
        <Card>
          {visible.map((friend) => (
            <PersonRow
              key={friend.id}
              name={friend.name}
              subtitle={subtitleFor(friend)}
              subtitleTone={
                balanceFor(friend) > 0 ? 'accent' : balanceFor(friend) < 0 ? 'danger' : 'muted'
              }
              onPress={() =>
                router.push({
                  pathname: '/friend/edit',
                  params: { id: friend.id },
                })
              }
              right={
                <View style={styles.actions}>
                  {balanceFor(friend) !== 0 ? (
                    <PrimaryButton
                      label="Settle"
                      variant="ghost"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: '/settle',
                          params: { participantId: friend.id },
                        })
                      }
                      accessibilityLabel={`Settle up with ${friend.name}`}
                    />
                  ) : null}
                  <PrimaryButton
                    label="✕"
                    variant="ghost"
                    size="sm"
                    onPress={() => confirmRemove(friend)}
                    accessibilityLabel={`Remove ${friend.name}`}
                  />
                </View>
              }
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
