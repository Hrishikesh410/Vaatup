import { router } from 'expo-router';

/**
 * Thin wrapper over the router, in the same spirit as the `Linking` and `Share`
 * wrappers: a screen reached by deep link has no history, so `router.back()`
 * would be dropped and leave the user stuck on it.
 */
export function goBackOrHome(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}
