import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which local account is signed in.
 *
 * The session is a pointer to a user id, not a credential, and lives in
 * AsyncStorage rather than in the database: it is device state, not application
 * data. When a backend arrives this is where a token would go instead.
 *
 * The key keeps the old product name deliberately. Renaming it would sign out
 * everyone who already has the app, for no gain the user can see.
 */
const STORAGE_KEY = 'quicksplit.session.v1';

export async function readSessionUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function writeSessionUserId(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, userId);
  } catch {
    // A failed write only costs the user a sign-in on next launch.
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do; the sign-out already happened in memory.
  }
}
