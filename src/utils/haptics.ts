import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Thin wrapper over expo-haptics. Every call is fire-and-forget and silently
 * ignored where the hardware or platform has nothing to offer (web, tablets,
 * devices with haptics switched off), so callers never need a guard.
 */

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function playSilently(effect: () => Promise<void>): void {
  if (!supported) return;
  effect().catch(() => {
    // A missing or disabled vibrator must never break the interaction.
  });
}

/** Choosing among options: a split method, a tip preset, a person. */
export function tapSelection(): void {
  playSilently(() => Haptics.selectionAsync());
}

/** A step completed and something changed on screen, e.g. a share marked paid. */
export function tapSuccess(): void {
  playSilently(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** An action was refused, e.g. WhatsApp is missing or the number is unusable. */
export function tapWarning(): void {
  playSilently(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Leaving the app or committing something, e.g. opening WhatsApp to send. */
export function tapImpact(): void {
  playSilently(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}
