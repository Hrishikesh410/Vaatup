import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { saveGroup } from '@/application/people-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { messageFor } from '@/domain/errors';
import { useFriends } from '@/hooks/use-data';
import { useRefresh } from '@/state/refresh';
import { useSession } from '@/state/session';
import { borderWidth, opacity, radius, spacing, useTheme } from '@/theme/theme';
import type { GroupWithMembers } from '@/types/group';
import { tapSelection, tapSuccess, tapWarning } from '@/utils/haptics';
import { goBackOrHome } from '@/utils/navigation';

export interface GroupFormProps {
  /** Absent when creating a group. */
  group?: GroupWithMembers;
}

/**
 * Create or rename a group and choose who is in it.
 *
 * The user is always a member — they are the one splitting — so they are not
 * offered as a choice here.
 */
export function GroupForm({ group }: GroupFormProps) {
  const { colors } = useTheme();
  const { user } = useSession();
  const { refresh } = useRefresh();
  const friends = useFriends();

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(
    group?.members.filter((member) => !member.isSelf).map((member) => member.id) ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleMember = (participantId: string) => {
    tapSelection();
    setMemberIds((current) =>
      current.includes(participantId)
        ? current.filter((memberId) => memberId !== participantId)
        : [...current, participantId]
    );
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await saveGroup(
        user.id,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          memberIds,
        },
        group?.id
      );
      tapSuccess();
      refresh();
      goBackOrHome();
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not save that group.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <PrimaryButton
          label={saving ? 'Saving…' : group ? 'Save changes' : 'Create group'}
          disabled={saving || name.trim() === ''}
          onPress={save}
        />
      }
    >
      <Card>
        <SectionLabel>{group ? 'Edit group' : 'New group'}</SectionLabel>
        <TextField
          label="Name"
          value={name}
          onChangeText={(next) => {
            setName(next);
            setError(null);
          }}
          placeholder="Goa trip"
          autoCapitalize="sentences"
          maxLength={40}
          autoFocus={!group}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="December long weekend"
          maxLength={120}
        />
      </Card>

      <Card>
        <SectionLabel>Members</SectionLabel>
        <AppText variant="caption" muted>
          You are always in your own groups.
        </AppText>

        {friends.data.length === 0 ? (
          <>
            <AppText variant="body" muted>
              Nobody saved yet. Add a person and they can join this group.
            </AppText>
            <PrimaryButton
              label="Add a person"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/friend/edit')}
            />
          </>
        ) : (
          <View style={styles.memberList}>
            {friends.data.map((friend) => {
              const selected = memberIds.includes(friend.id);
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => toggleMember(friend.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={friend.name}
                  style={({ pressed }) => [
                    styles.member,
                    {
                      backgroundColor: selected ? colors.surfaceStrong : 'transparent',
                      borderColor: selected ? colors.accent : colors.border,
                      opacity: pressed ? opacity.pressed : 1,
                    },
                  ]}
                >
                  <AppText variant="body" weight={selected ? '600' : undefined}>
                    {selected ? '✓ ' : ''}
                    {friend.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  memberList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  member: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
  },
});
