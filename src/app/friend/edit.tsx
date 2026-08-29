import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { pickContact } from '@/application/contacts-service';
import { saveFriend } from '@/application/people-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { messageFor } from '@/domain/errors';
import { useFriends } from '@/hooks/use-data';
import { useRefresh } from '@/state/refresh';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme/theme';
import { tapSuccess, tapWarning } from '@/utils/haptics';
import { goBackOrHome } from '@/utils/navigation';
import { isValidPhoneNumber } from '@/utils/phone';

/** Adds a person, or edits one already saved when an id is passed. */
export default function FriendEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const { user } = useSession();
  const { refresh } = useRefresh();
  const friends = useFriends();

  const existing = id ? friends.data.find((friend) => friend.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The friends list arrives a moment after the screen, so seed the fields once
  // the person being edited actually shows up.
  const [seeded, setSeeded] = useState(!id);
  if (!seeded && existing) {
    setName(existing.name);
    setPhone(existing.phone ?? '');
    setEmail(existing.email ?? '');
    setSeeded(true);
  }

  const phoneUsable = phone.trim() === '' || isValidPhoneNumber(phone);
  const ready = name.trim() !== '' && phoneUsable;

  /** Fills the fields from the address book, leaving them editable as they were. */
  const chooseFromContacts = async () => {
    const result = await pickContact();

    if (!result.ok) {
      if (result.reason === 'cancelled') return;
      tapWarning();
      Alert.alert(
        'Could not open contacts',
        result.reason === 'denied'
          ? 'VaatUp needs permission to read the contact you pick. Allow contacts in Settings, or type the name and number here.'
          : 'This phone would not open its contacts. Type the name and number here instead.'
      );
      return;
    }

    setName(result.contact.name);
    setPhone(result.contact.phone ?? '');
    setError(null);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await saveFriend(
        user.id,
        {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        },
        id
      );
      tapSuccess();
      refresh();
      goBackOrHome();
    } catch (caught) {
      tapWarning();
      setError(messageFor(caught, 'Could not save that person.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <PrimaryButton
          label={saving ? 'Saving…' : existing ? 'Save changes' : 'Add person'}
          disabled={saving || !ready}
          onPress={save}
        />
      }
    >
      <Card>
        <SectionLabel>{existing ? 'Edit person' : 'New person'}</SectionLabel>
        {existing ? null : (
          <PrimaryButton
            label="Choose from contacts"
            variant="secondary"
            size="sm"
            onPress={() => void chooseFromContacts()}
          />
        )}
        <TextField
          label="Name"
          value={name}
          onChangeText={(next) => {
            setName(next);
            setError(null);
          }}
          placeholder="Aditi"
          autoCapitalize="words"
          maxLength={40}
          autoFocus={!existing}
        />
        <TextField
          label="Phone (optional)"
          value={phone}
          onChangeText={(next) => {
            setPhone(next);
            setError(null);
          }}
          placeholder="9876543210"
          keyboardType="phone-pad"
          hint="Needed to send them their share on WhatsApp."
          error={phoneUsable ? undefined : 'That number does not look right.'}
        />
        <TextField
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          placeholder="aditi@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Card>

      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}

      <AppText variant="caption" muted>
        They do not need VaatUp installed. Nothing is sent to them until you press send in WhatsApp.
      </AppText>
    </Screen>
  );
}
