import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { useGroups } from '@/hooks/use-data';
import { spacing, useTheme } from '@/theme/theme';
import type { GroupWithMembers } from '@/types/group';

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const groups = useGroups();

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + spacing.xl }}
      footer={
        <PrimaryButton label="New group" icon="+" onPress={() => router.push('/group/new')} />
      }
    >
      <AppText variant="heading">Groups</AppText>
      <AppText variant="body" muted>
        A group keeps a trip or a flat together, so its balances stay separate from everything else.
      </AppText>

      {groups.data.length === 0 ? (
        groups.loading ? null : (
          <Card>
            <AppText variant="body" muted>
              No groups yet. Create one for a trip, a flat, or the weekly office lunch.
            </AppText>
          </Card>
        )
      ) : (
        groups.data.map((group) => <GroupCard key={group.id} group={group} />)
      )}
    </Screen>
  );
}

function GroupCard({ group }: { group: GroupWithMembers }) {
  const { colors } = useTheme();

  const memberNames = group.members
    .map((member) => (member.isSelf ? 'You' : member.name))
    .join(', ');

  return (
    <Card>
      <View style={styles.header}>
        <SectionLabel>{group.name}</SectionLabel>
        <PrimaryButton
          label="Open"
          variant="ghost"
          size="sm"
          onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
          accessibilityLabel={`Open ${group.name}`}
        />
      </View>

      {group.description ? (
        <AppText variant="body" muted numberOfLines={2}>
          {group.description}
        </AppText>
      ) : null}

      <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
        {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
        {memberNames ? ` · ${memberNames}` : ''}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
