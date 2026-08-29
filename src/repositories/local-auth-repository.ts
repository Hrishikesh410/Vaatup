import type { Database } from '@/database';
import { AuthenticationError, EmailInUseError } from '@/domain/errors';
import { clearSession, readSessionUserId, writeSessionUserId } from '@/storage/session';
import type { LoginInput, RegisterInput, User } from '@/types/user';
import { nowIso } from '@/utils/date';
import { createId } from '@/utils/id';
import { createSalt, digestsMatch, hashPassword } from '@/utils/password';

import type { AuthRepository } from './types';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
}

/** The password digest never leaves this module. */
function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Accounts held on the device.
 *
 * This exists so the data model has an owner and the UI has a session to
 * consume, both of which a real backend will later provide. Screens depend on
 * {@link AuthRepository}, so replacing this with an API-backed implementation
 * does not touch them.
 */
export class LocalAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  private findByEmail(email: string): Promise<UserRow | null> {
    return this.db.queryOne<UserRow>(
      `SELECT id, name, email, password_hash, password_salt, created_at, updated_at
         FROM users WHERE lower(email) = lower(?)`,
      [email.trim()]
    );
  }

  async register(input: RegisterInput): Promise<User> {
    const email = input.email.trim();
    if (await this.findByEmail(email)) {
      throw new EmailInUseError('An account already uses that email on this device.');
    }

    const salt = await createSalt();
    const user: User = {
      id: createId('user'),
      name: input.name.trim(),
      email,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `INSERT INTO users (id, name, email, password_hash, password_salt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        await hashPassword(input.password, salt),
        salt,
        user.createdAt,
        user.updatedAt,
      ]
    );

    await writeSessionUserId(user.id);
    return user;
  }

  async login(input: LoginInput): Promise<User> {
    const row = await this.findByEmail(input.email);
    // Same message either way, so the screen cannot be used to discover which
    // email addresses have accounts.
    const failed = new AuthenticationError('Those details do not match an account.');
    if (!row) throw failed;

    const attempt = await hashPassword(input.password, row.password_salt);
    if (!digestsMatch(attempt, row.password_hash)) throw failed;

    await writeSessionUserId(row.id);
    return toUser(row);
  }

  async logout(): Promise<void> {
    await clearSession();
  }

  async getCurrentUser(): Promise<User | null> {
    const userId = await readSessionUserId();
    if (!userId) return null;

    const row = await this.db.queryOne<UserRow>(
      `SELECT id, name, email, password_hash, password_salt, created_at, updated_at
         FROM users WHERE id = ?`,
      [userId]
    );
    if (!row) {
      // The session points at an account that is gone; drop it rather than
      // leaving the app in a signed-in state with no user.
      await clearSession();
      return null;
    }
    return toUser(row);
  }

  async updateProfile(userId: string, changes: { name?: string; email?: string }): Promise<User> {
    const existing = await this.db.queryOne<UserRow>(
      `SELECT id, name, email, password_hash, password_salt, created_at, updated_at
         FROM users WHERE id = ?`,
      [userId]
    );
    if (!existing) throw new AuthenticationError('You are not signed in.');

    const email = changes.email?.trim() ?? existing.email;
    if (email.toLowerCase() !== existing.email.toLowerCase()) {
      const clash = await this.findByEmail(email);
      if (clash) throw new EmailInUseError('An account already uses that email on this device.');
    }

    const name = changes.name?.trim() || existing.name;
    const updatedAt = nowIso();
    await this.db.execute(`UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?`, [
      name,
      email,
      updatedAt,
      userId,
    ]);

    return { ...toUser(existing), name, email, updatedAt };
  }
}
