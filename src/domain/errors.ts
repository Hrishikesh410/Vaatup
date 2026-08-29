/**
 * Errors the application layer is allowed to show a user.
 *
 * Infrastructure failures (`DatabaseError`) are caught at the service boundary
 * and re-thrown as one of these, so a screen never has to interpret SQL.
 */

export class DomainError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidAmountError extends DomainError {}
export class InvalidSplitError extends DomainError {}
export class InvalidPayerError extends DomainError {}
export class ExpenseNotFoundError extends DomainError {}
export class GroupNotFoundError extends DomainError {}
export class ParticipantNotFoundError extends DomainError {}
export class SettlementError extends DomainError {}
export class AuthenticationError extends DomainError {}
export class EmailInUseError extends DomainError {}
export class StorageError extends DomainError {}

/** True for errors whose message is safe and useful to show as-is. */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** The message to show for any thrown value, without leaking internals. */
export function messageFor(error: unknown, fallback = 'Something went wrong.'): string {
  return isDomainError(error) ? error.message : fallback;
}
