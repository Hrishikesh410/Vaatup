import { DatabaseError } from '@/database';
import { AuthenticationError, StorageError, isDomainError } from '@/domain/errors';
import { getRepositories } from '@/repositories';
import type { Participant } from '@/types/participant';
import type { LoginInput, RegisterInput, User } from '@/types/user';
import { validateEmail, validatePassword } from '@/utils/password';

/**
 * Sign-in use cases.
 *
 * Alongside the account itself, this guarantees the invariant the rest of the
 * app relies on: a signed-in user always has a participant row, because they
 * are a person in their own expenses.
 */

export interface Session {
  user: User;
  self: Participant;
}

async function asApplicationError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isDomainError(error)) throw error;
    if (error instanceof DatabaseError) {
      throw new StorageError('Could not read this device’s data.', error);
    }
    throw error;
  }
}

async function sessionFor(user: User): Promise<Session> {
  const { participants } = await getRepositories();
  const self = await asApplicationError(() =>
    participants.ensureSelf(user.id, user.name, user.email)
  );
  return { user, self };
}

export async function register(input: RegisterInput): Promise<Session> {
  if (input.name.trim() === '') throw new AuthenticationError('Enter your name.');

  const email = validateEmail(input.email);
  if (!email.valid) throw new AuthenticationError(email.message ?? 'Check your email address.');

  const password = validatePassword(input.password);
  if (!password.valid) {
    throw new AuthenticationError(password.message ?? 'Choose a longer password.');
  }

  const { auth } = await getRepositories();
  return sessionFor(await asApplicationError(() => auth.register(input)));
}

export async function login(input: LoginInput): Promise<Session> {
  if (input.email.trim() === '' || input.password === '') {
    throw new AuthenticationError('Enter your email and password.');
  }

  const { auth } = await getRepositories();
  return sessionFor(await asApplicationError(() => auth.login(input)));
}

export async function logout(): Promise<void> {
  const { auth } = await getRepositories();
  await asApplicationError(() => auth.logout());
}

/** Restores the session on launch. Null means the user has to sign in. */
export async function restoreSession(): Promise<Session | null> {
  const { auth } = await getRepositories();
  const user = await asApplicationError(() => auth.getCurrentUser());
  return user ? sessionFor(user) : null;
}

export interface ProfileChanges {
  name?: string;
  email?: string;
  /** Lives on the user's participant row, alongside everyone else's number. */
  phone?: string;
}

export async function updateProfile(userId: string, changes: ProfileChanges): Promise<Session> {
  if (changes.name !== undefined && changes.name.trim() === '') {
    throw new AuthenticationError('Enter your name.');
  }

  if (changes.email !== undefined) {
    const email = validateEmail(changes.email);
    if (!email.valid) throw new AuthenticationError(email.message ?? 'Check your email address.');
  }

  const { auth, participants } = await getRepositories();
  const user = await asApplicationError(() =>
    auth.updateProfile(userId, { name: changes.name, email: changes.email })
  );

  // The user's own participant row shows up in every split, so keep it in step
  // with the account.
  const self = await asApplicationError(() => participants.getSelf(userId));
  if (self) {
    const phone = changes.phone === undefined ? self.phone : changes.phone || undefined;
    if (self.name !== user.name || self.phone !== phone) {
      await asApplicationError(() => participants.update(self.id, { name: user.name, phone }));
    }
  }

  return sessionFor(user);
}
