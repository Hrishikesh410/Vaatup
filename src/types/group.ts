import type { Participant, ParticipantId } from './participant';

export type GroupId = string;

export interface Group {
  id: GroupId;
  ownerUserId: string;
  name: string;
  description?: string;
  imageUri?: string;
  createdAt: string;
  updatedAt: string;
}

/** A group plus its members, which is how every screen actually needs it. */
export interface GroupWithMembers extends Group {
  members: Participant[];
}

export interface GroupInput {
  name: string;
  description?: string;
  imageUri?: string;
  memberIds: ParticipantId[];
}
