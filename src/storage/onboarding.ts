import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which accounts have already been through the first-bill screen.
 *
 * A list of user ids rather than one flag: the database holds an account per
 * person who signs up on this device, and the second of them deserves the same
 * introduction as the first.
 *
 * Like the session, this is device state rather than application data, so it
 * lives here instead of in the database. The key carries the same prefix its
 * siblings do so all of the app's stored keys sort together.
 */
const STORAGE_KEY = 'quicksplit.onboarding.v1';

function parseUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string');
}

async function readUserIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseUserIds(JSON.parse(raw) as unknown);
  } catch {
    // Unreadable counts as empty: offering the screen once more is a smaller
    // cost than a launch that fails over a corrupt value.
    return [];
  }
}

export async function hasFinishedOnboarding(userId: string): Promise<boolean> {
  return (await readUserIds()).includes(userId);
}

export async function markOnboardingFinished(userId: string): Promise<void> {
  try {
    const finished = await readUserIds();
    if (finished.includes(userId)) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...finished, userId]));
  } catch {
    // A failed write only costs the user the same screen again next launch.
  }
}
