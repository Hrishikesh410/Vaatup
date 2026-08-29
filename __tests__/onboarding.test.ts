import AsyncStorage from '@react-native-async-storage/async-storage';

import { hasFinishedOnboarding, markOnboardingFinished } from '@/storage/onboarding';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Asserted here so a rename that would show the first-bill screen again to
// everyone who already has the app fails the suite instead.
const KEY = 'quicksplit.onboarding.v1';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('onboarding storage', () => {
  it('has not been through it on a fresh install', async () => {
    await expect(hasFinishedOnboarding('user-1')).resolves.toBe(false);
  });

  it('remembers an account that has finished', async () => {
    await markOnboardingFinished('user-1');
    await expect(hasFinishedOnboarding('user-1')).resolves.toBe(true);
  });

  it('answers per account, so a second sign-up is still introduced', async () => {
    await markOnboardingFinished('user-1');
    await expect(hasFinishedOnboarding('user-2')).resolves.toBe(false);
  });

  it('keeps earlier accounts when another finishes', async () => {
    await markOnboardingFinished('user-1');
    await markOnboardingFinished('user-2');

    await expect(hasFinishedOnboarding('user-1')).resolves.toBe(true);
    await expect(hasFinishedOnboarding('user-2')).resolves.toBe(true);
  });

  it('records an account once however many times it is marked', async () => {
    await markOnboardingFinished('user-1');
    await markOnboardingFinished('user-1');

    await expect(AsyncStorage.getItem(KEY)).resolves.toBe(JSON.stringify(['user-1']));
  });

  it('survives corrupt json', async () => {
    await AsyncStorage.setItem(KEY, '{oops');
    await expect(hasFinishedOnboarding('user-1')).resolves.toBe(false);
  });

  it('ignores a stored value that is not a list of ids', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ 'user-1': true }));
    await expect(hasFinishedOnboarding('user-1')).resolves.toBe(false);
  });
});
