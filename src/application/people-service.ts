import { DatabaseError } from '@/database';
import { ParticipantNotFoundError, StorageError, isDomainError } from '@/domain/errors';
import { getRepositories } from '@/repositories';
import type { GroupInput, GroupWithMembers } from '@/types/group';
import type { Participant, ParticipantId, ParticipantInput } from '@/types/participant';
import type { PersonId } from '@/types/person';

/**
 * Use cases for the people the user splits with, and the groups they belong to.
 *
 * Friends and expense participants are the same records; a friend is simply a
 * participant that has been saved for reuse. Removing one is always a soft
 * delete, because expenses refer to them.
 */

async function asApplicationError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isDomainError(error)) throw error;
    if (error instanceof DatabaseError) {
      throw new StorageError('Could not save to this device.', error);
    }
    throw error;
  }
}

export async function listFriends(ownerUserId: string): Promise<Participant[]> {
  const { participants } = await getRepositories();
  return asApplicationError(() => participants.listFriends(ownerUserId));
}

export async function listPeople(ownerUserId: string): Promise<Participant[]> {
  const { participants } = await getRepositories();
  return asApplicationError(() => participants.listAll(ownerUserId));
}

export async function getSelf(ownerUserId: string): Promise<Participant | null> {
  const { participants } = await getRepositories();
  return asApplicationError(() => participants.getSelf(ownerUserId));
}

export async function saveFriend(
  ownerUserId: string,
  input: ParticipantInput,
  id?: ParticipantId
): Promise<Participant> {
  const name = input.name.trim();
  if (name === '') throw new ParticipantNotFoundError('Enter a name.');

  const { participants } = await getRepositories();
  return asApplicationError(() =>
    id
      ? participants.update(id, { ...input, name })
      : participants.create(ownerUserId, { ...input, name })
  );
}

export async function removeFriend(id: ParticipantId): Promise<void> {
  const { participants } = await getRepositories();
  await asApplicationError(() => participants.remove(id));
}

/**
 * Finds a saved person by name, or saves a new one.
 *
 * The split flow lets the user type a name without thinking about contacts, so
 * this keeps the friends list from filling up with duplicates of the same
 * person spelled the same way.
 */
export async function findOrCreateByName(
  ownerUserId: string,
  name: string,
  phone?: string
): Promise<Participant> {
  const { participants } = await getRepositories();
  const trimmed = name.trim();
  const existing = await asApplicationError(() => participants.listAll(ownerUserId));

  const match = existing.find(
    (person) => person.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (match) {
    // Learn a phone number the first time it is given for someone already saved.
    if (phone && !match.phone) {
      return asApplicationError(() => participants.update(match.id, { name: match.name, phone }));
    }
    return match;
  }

  return asApplicationError(() => participants.create(ownerUserId, { name: trimmed, phone }));
}

/**
 * Maps the people on a draft to saved participants, creating any that are new.
 *
 * The split flow lets someone type a name and keep moving, so draft people can
 * be temporary. Expenses reference real participants, so this resolves them all
 * at the moment the expense is saved — matching on id first (picked from the
 * friends list), then on name, and only then creating someone.
 */
export async function resolveParticipants(
  ownerUserId: string,
  people: { id: PersonId; name: string; phone?: string }[]
): Promise<Map<PersonId, ParticipantId>> {
  const { participants } = await getRepositories();
  const saved = await asApplicationError(() => participants.listAll(ownerUserId));
  const resolved = new Map<PersonId, ParticipantId>();

  for (const person of people) {
    const byId = saved.find((candidate) => candidate.id === person.id);
    if (byId) {
      resolved.set(person.id, byId.id);
      continue;
    }

    const participant = await findOrCreateByName(ownerUserId, person.name, person.phone);
    resolved.set(person.id, participant.id);
  }

  return resolved;
}

export async function listGroups(ownerUserId: string): Promise<GroupWithMembers[]> {
  const { groups } = await getRepositories();
  return asApplicationError(() => groups.list(ownerUserId));
}

export async function getGroup(id: string): Promise<GroupWithMembers | null> {
  const { groups } = await getRepositories();
  return asApplicationError(() => groups.getById(id));
}

export async function saveGroup(
  ownerUserId: string,
  input: GroupInput,
  id?: string
): Promise<GroupWithMembers> {
  const { groups, participants } = await getRepositories();

  // The user is always a member of their own groups: they are the one splitting.
  const self = await asApplicationError(() => participants.getSelf(ownerUserId));
  const memberIds = self ? [...new Set([self.id, ...input.memberIds])] : input.memberIds;
  const withSelf = { ...input, memberIds };

  return asApplicationError(() =>
    id ? groups.update(id, withSelf) : groups.create(ownerUserId, withSelf)
  );
}

export async function removeGroup(id: string): Promise<void> {
  const { groups } = await getRepositories();
  await asApplicationError(() => groups.remove(id));
}
