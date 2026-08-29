import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { pickContact } from '@/application/contacts-service';
import { AppText } from '@/components/app-text';
import { Card, SectionLabel } from '@/components/card';
import { PersonRow } from '@/components/person-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useFriends } from '@/hooks/use-data';
import { useBillDraft } from '@/state/bill-draft';
import { useSession } from '@/state/session';
import { avatar, opacity, radius, spacing, useTheme } from '@/theme/theme';
import type { Person } from '@/types/person';
import { tapSelection, tapSuccess, tapWarning } from '@/utils/haptics';
import { isValidPhoneNumber } from '@/utils/phone';
import { validatePeople, validatePersonName } from '@/utils/validation';

export default function PeopleScreen() {
  const { colors } = useTheme();
  const { self } = useSession();
  const { draft, addPerson, updatePerson, removePerson } = useBillDraft();
  const friends = useFriends();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(draft.people.length === 0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [phoneError, setPhoneError] = useState<string>();

  /**
   * The user is on their own bill, and is the default payer, so they are added
   * first on a fresh split. Removing themselves is allowed — paying for other
   * people without eating is a real case.
   */
  useEffect(() => {
    if (!self || draft.people.length > 0 || draft.expenseId) return;
    addPerson(self.name, self.phone, self.id);
  }, [self, draft.people.length, draft.expenseId, addPerson]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setNameError(undefined);
    setPhoneError(undefined);
    setEditingId(null);
  };

  const openEditor = (person: Person) => {
    setEditingId(person.id);
    setName(person.name);
    setPhone(person.phone ?? '');
    setNameError(undefined);
    setPhoneError(undefined);
    setFormOpen(true);
  };

  const submit = () => {
    const nameCheck = validatePersonName(name, draft.people, editingId ?? undefined);
    const phoneOk = phone.trim() === '' || isValidPhoneNumber(phone);

    setNameError(nameCheck.valid ? undefined : nameCheck.message);
    setPhoneError(phoneOk ? undefined : 'Enter a valid phone number.');
    if (!nameCheck.valid || !phoneOk) {
      tapWarning();
      return;
    }

    tapSuccess();

    if (editingId) {
      updatePerson({
        id: editingId,
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      resetForm();
      setFormOpen(false);
      return;
    }

    addPerson(name, phone);
    resetForm();
  };

  /**
   * Fills the form from the address book instead of adding the person outright.
   * The number that comes back is often a landline or an old one, and the user
   * gets to see and fix it before it is used to message anybody.
   */
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

    tapSelection();
    setName(result.contact.name);
    setPhone(result.contact.phone ?? '');
    setNameError(undefined);
    setPhoneError(undefined);
  };

  const quickAdd = (person: Person) => {
    tapSelection();
    // Passing the saved id keeps this the same participant rather than a
    // second person who happens to share a name.
    addPerson(person.name, person.phone, person.id);
  };

  const suggestions = friends.data
    .filter(
      (person) =>
        !draft.people.some(
          (added) => added.name.trim().toLowerCase() === person.name.trim().toLowerCase()
        )
    )
    .slice(0, 6);

  const peopleCheck = validatePeople(draft.people);

  return (
    <Screen
      footer={
        <>
          {peopleCheck.valid ? null : (
            <AppText variant="caption" muted>
              {peopleCheck.message}
            </AppText>
          )}
          <PrimaryButton
            label="Choose split"
            disabled={!peopleCheck.valid}
            onPress={() => router.push('/bill/split')}
          />
        </>
      }
    >
      {draft.people.length > 0 ? (
        <Card>
          {draft.people.map((person) => (
            <PersonRow
              key={person.id}
              name={person.name}
              subtitle={person.phone ?? 'No phone — needed for WhatsApp'}
              onPress={() => openEditor(person)}
              right={
                <Pressable
                  onPress={() => {
                    tapSelection();
                    removePerson(person.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${person.name}`}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.remove,
                    {
                      backgroundColor: colors.surfaceStrong,
                      opacity: pressed ? opacity.muted : 1,
                    },
                  ]}
                >
                  <AppText variant="body" muted weight="600">
                    ✕
                  </AppText>
                </Pressable>
              }
            />
          ))}
        </Card>
      ) : null}

      {formOpen ? (
        <Card>
          <SectionLabel>{editingId ? 'Edit person' : 'Add person'}</SectionLabel>
          {editingId ? null : (
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
            onChangeText={setName}
            placeholder="Rahul"
            autoFocus
            autoCapitalize="words"
            error={nameError}
            returnKeyType="next"
            maxLength={40}
          />
          <TextField
            label="Phone number (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="9876543210"
            keyboardType="phone-pad"
            hint="Needed only to send their share on WhatsApp."
            error={phoneError}
            onSubmitEditing={submit}
            returnKeyType="done"
            maxLength={20}
          />
          <View style={styles.formActions}>
            <PrimaryButton
              label={editingId ? 'Save' : 'Add'}
              onPress={submit}
              size="sm"
              style={styles.grow}
            />
            {draft.people.length > 0 ? (
              <PrimaryButton
                label="Done"
                variant="ghost"
                size="sm"
                onPress={() => {
                  resetForm();
                  setFormOpen(false);
                }}
              />
            ) : null}
          </View>
        </Card>
      ) : (
        <PrimaryButton
          label="Add person"
          icon="+"
          variant="secondary"
          onPress={() => {
            resetForm();
            setFormOpen(true);
          }}
        />
      )}

      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          <SectionLabel>Split with again</SectionLabel>
          <View style={styles.suggestionRow}>
            {suggestions.map((person) => (
              <PrimaryButton
                key={person.id}
                label={person.name}
                icon="+"
                variant="ghost"
                size="sm"
                onPress={() => quickAdd(person)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  remove: {
    width: avatar.sm,
    height: avatar.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
  suggestions: {
    gap: spacing.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
