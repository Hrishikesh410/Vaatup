import type { Person, PersonId } from './person';

export type ParticipantId = PersonId;

/**
 * A person the signed-in user splits money with, stored locally.
 *
 * This is the persistent form of {@link Person}: the same fields the split flow
 * has always used, plus ownership and bookkeeping. There is no separate
 * "friend" type — a friend is a participant, and the user's own row is the one
 * with `isSelf`. Anyone can be a participant without having a VaatUp
 * account; `linkedUserId` is only set for people who happen to have one.
 */
export interface Participant extends Person {
  ownerUserId: string;
  linkedUserId?: string;
  email?: string;
  avatarUri?: string;
  isSelf: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What the UI supplies when saving a participant. */
export interface ParticipantInput {
  name: string;
  phone?: string;
  email?: string;
  avatarUri?: string;
}

/** Reduces a participant to the shape the existing split flow works with. */
export function toPerson(participant: Participant): Person {
  return {
    id: participant.id,
    name: participant.name,
    phone: participant.phone,
  };
}
