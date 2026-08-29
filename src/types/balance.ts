import type { Money } from './money';
import type { ParticipantId } from './participant';

/**
 * One participant's position, derived entirely from expenses and settlements.
 *
 * There is no stored balance column anywhere in the schema. A balance is always
 * recomputed, which means it cannot drift out of step with the records it
 * summarises.
 */
export interface ParticipantBalance {
  participantId: ParticipantId;
  /** Money this person put in, across expense payments. */
  paid: Money;
  /** This person's share of what was consumed. */
  owed: Money;
  /** Money this person has since handed over in settlements. */
  settledOut: Money;
  /** Money this person has since received in settlements. */
  settledIn: Money;
  /** `paid - owed + settledOut - settledIn`. Positive means owed money. */
  net: Money;
}

/** The whole picture for one scope, e.g. everything or a single group. */
export interface BalanceSheet {
  balances: ParticipantBalance[];
  /** Sum of the positive nets: money the group owes back to people. */
  totalCredit: Money;
  /** Sum of the negative nets, as a positive number. */
  totalDebt: Money;
}

/** How much one person owes another, after settlements between the pair. */
export interface PairwiseDebt {
  fromParticipantId: ParticipantId;
  toParticipantId: ParticipantId;
  amount: Money;
}

/** A suggested payment that reduces the number of transfers needed. */
export interface SettlementSuggestion {
  fromParticipantId: ParticipantId;
  toParticipantId: ParticipantId;
  amount: Money;
}

/** The signed-in user's position against one other person. */
export interface FriendBalance {
  participantId: ParticipantId;
  /** Positive: they owe the user. Negative: the user owes them. */
  net: Money;
}
