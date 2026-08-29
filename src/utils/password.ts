import * as Crypto from 'expo-crypto';

/**
 * Password digests for VaatUp's local accounts.
 *
 * This is not production-grade authentication and is not presented as such.
 * There is no server, no rate limiting and no key-derivation function designed
 * for passwords (bcrypt, scrypt, Argon2); anyone with the device and the
 * database file has the data regardless. What this does buy is that a password
 * is never written to disk in plain text, and that each account has its own
 * salt so identical passwords produce different digests.
 *
 * When a backend arrives, authentication moves to it and this module goes away.
 */

/**
 * Stretching rounds. Each round is a native digest call, so this trades login
 * latency against brute-force cost; 1,000 keeps a sign-in imperceptible while
 * being meaningfully slower than a single hash.
 */
const ROUNDS = 1_000;
const SALT_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSalt(): Promise<string> {
  return toHex(await Crypto.getRandomBytesAsync(SALT_BYTES));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  let digest = `${salt}:${password}`;
  for (let round = 0; round < ROUNDS; round += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}

/**
 * Compares digests without leaking where they first differ. The comparison is
 * on hashes rather than passwords, so this is belt and braces, but it costs
 * nothing.
 */
export function digestsMatch(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

export interface PasswordRule {
  valid: boolean;
  message?: string;
}

export function validatePassword(password: string): PasswordRule {
  if (password.length < 8) {
    return { valid: false, message: 'Use at least 8 characters.' };
  }
  return { valid: true };
}

export function validateEmail(email: string): PasswordRule {
  // Deliberately loose: enough to catch a typo, not enough to reject a valid
  // address that happens to look unusual.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { valid: false, message: 'Enter a valid email address.' };
  }
  return { valid: true };
}
