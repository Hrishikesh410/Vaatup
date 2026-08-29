import type { ExpensePayer } from '@/types/expense';
import type { Money } from '@/types/money';
import type { Person } from '@/types/person';

import {
  calculateRemaining,
  percentagesBalance,
  sumPercentages,
  sumShareCounts,
  type SplitInput,
} from './calculations';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const OK: ValidationResult = { valid: true };

export function validateBillAmount(base: Money | null): ValidationResult {
  if (base === null) return { valid: false, message: 'Enter a bill amount.' };
  if (base <= 0) return { valid: false, message: 'Bill amount must be more than zero.' };
  return OK;
}

export function validatePersonName(
  name: string,
  existing: Person[],
  editingId?: string
): ValidationResult {
  const trimmed = name.trim();
  if (trimmed === '') return { valid: false, message: 'Enter a name.' };
  const clash = existing.some(
    (person) =>
      person.id !== editingId && person.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (clash) return { valid: false, message: 'That name is already in this bill.' };
  return OK;
}

export function validatePeople(people: Person[]): ValidationResult {
  if (people.length === 0) return { valid: false, message: 'Add at least one person.' };
  return OK;
}

export interface SplitValidation extends ValidationResult {
  /** Unallocated amount for an exact split. Negative means over-allocated. */
  remaining?: Money;
  /** Entered percentage total for a percentage split. */
  percentTotal?: number;
  /** Entered share total for a shares split. */
  shareTotal?: number;
}

/**
 * Decides whether a split is finishable. The screens use this both to disable
 * the primary action and to render the balance hint, and the expense service
 * uses it before writing to the database, so the rule lives in one place.
 *
 * Nothing here adjusts the user's input to make it balance: an unbalanced split
 * is reported, never silently corrected.
 */
export function validateSplit(input: SplitInput): SplitValidation {
  const amount = validateBillAmount(input.total);
  if (!amount.valid) return amount;

  const people = validatePeople(input.people);
  if (!people.valid) return people;

  if (input.splitType === 'exact') {
    const remaining = calculateRemaining(input.total, input.people, input.exactAmounts);
    if (remaining !== 0) {
      return { valid: false, message: "Split doesn't balance.", remaining };
    }
    return { ...OK, remaining: 0 };
  }

  if (input.splitType === 'percentage') {
    const percentTotal = sumPercentages(input.people, input.percentages);
    if (!percentagesBalance(input.people, input.percentages)) {
      return {
        valid: false,
        message: 'Percentages must total 100%.',
        percentTotal,
      };
    }
    return { ...OK, percentTotal };
  }

  if (input.splitType === 'shares') {
    const shareTotal = sumShareCounts(input.people, input.shareCounts);
    if (shareTotal <= 0) {
      return {
        valid: false,
        message: 'Give at least one person a share.',
        shareTotal,
      };
    }
    return { ...OK, shareTotal };
  }

  return OK;
}

/**
 * Payers must cover the expense exactly. An expense where the payments do not
 * add up to the total is not a rounding problem, it is missing information, so
 * it is rejected rather than adjusted.
 */
export function validatePayers(payers: ExpensePayer[], total: Money): ValidationResult {
  if (payers.length === 0) return { valid: false, message: 'Choose who paid.' };
  if (payers.some((payer) => payer.amountPaid < 0)) {
    return { valid: false, message: 'A payment cannot be negative.' };
  }

  const paid = payers.reduce((sum, payer) => sum + Math.round(payer.amountPaid), 0);
  if (paid !== total) {
    return { valid: false, message: "Payments don't add up to the total." };
  }
  return OK;
}
