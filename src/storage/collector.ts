import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidVpa, normalizeVpa } from '@/utils/upi';

/**
 * The user's own UPI details, used to ask for money. Stored on this device
 * only: VaatUp has no account, no server, and never transmits it. It ends
 * up in a WhatsApp message only when the user sends one.
 *
 * The key keeps the old product name deliberately: renaming it would silently
 * lose the saved UPI ID of everyone who already has the app.
 */
const STORAGE_KEY = 'quicksplit.collector.v1';

export interface CollectorProfile {
  vpa: string;
  name: string;
  /** Lets the user keep a saved address but leave it out of messages. */
  enabled: boolean;
}

export const EMPTY_COLLECTOR: CollectorProfile = {
  vpa: '',
  name: '',
  enabled: true,
};

function parseStoredProfile(value: unknown): CollectorProfile | null {
  if (typeof value !== 'object' || value === null) return null;
  const profile = value as Partial<CollectorProfile>;
  if (typeof profile.vpa !== 'string' || !isValidVpa(profile.vpa)) return null;
  return {
    vpa: normalizeVpa(profile.vpa),
    name: typeof profile.name === 'string' ? profile.name : '',
    enabled: profile.enabled !== false,
  };
}

export async function loadCollector(): Promise<CollectorProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseStoredProfile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveCollector(profile: CollectorProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...profile, vpa: normalizeVpa(profile.vpa) })
    );
  } catch {
    // Best-effort: losing this only means retyping the address.
  }
}

export async function clearCollector(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover from.
  }
}
