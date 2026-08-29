import type { Money } from '@/types/money';
import type { Person, PersonId } from '@/types/person';
import type { Share } from '@/types/split';

import { shareFor } from './calculations';

/**
 * Who has settled up. Kept as a list of person ids rather than a flag on
 * `Person` so history written before paid tracking stays readable, and so the
 * pure functions here can be unit tested without any React or storage.
 */

export function isPaid(paid: PersonId[], id: PersonId): boolean {
  return paid.includes(id);
}

/** Adds or removes one person, never duplicating an id. */
export function togglePaidId(paid: PersonId[], id: PersonId): PersonId[] {
  return isPaid(paid, id) ? paid.filter((entry) => entry !== id) : [...paid, id];
}

/** Drops ids for people no longer on the bill, e.g. after one is removed. */
export function keepPaidFor(paid: PersonId[], people: Person[]): PersonId[] {
  return paid.filter((id) => people.some((person) => person.id === id));
}

export interface PaidStatus {
  paidCount: number;
  peopleCount: number;
  /** Sum of the shares of everyone marked paid. */
  collected: Money;
  /** What is still owed across the people who have not paid. */
  outstanding: Money;
  settled: boolean;
}

export function paidStatus(people: Person[], shares: Share[], paid: PersonId[]): PaidStatus {
  let collected = 0;
  let outstanding = 0;
  let paidCount = 0;

  for (const person of people) {
    const amount = shareFor(shares, person.id);
    if (isPaid(paid, person.id)) {
      collected += amount;
      paidCount += 1;
    } else {
      outstanding += amount;
    }
  }

  return {
    paidCount,
    peopleCount: people.length,
    collected,
    outstanding,
    settled: people.length > 0 && paidCount === people.length,
  };
}
