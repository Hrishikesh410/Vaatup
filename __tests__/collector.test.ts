import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearCollector, loadCollector, saveCollector } from '@/storage/collector';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Still the pre-VaatUp key, and asserted here so a well-meaning rename that
// would strand existing users' saved UPI details fails the suite instead.
const KEY = 'quicksplit.collector.v1';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('collector storage', () => {
  it('starts empty', async () => {
    await expect(loadCollector()).resolves.toBeNull();
  });

  it('round-trips a profile', async () => {
    await saveCollector({
      vpa: 'asha@okhdfcbank',
      name: 'Asha',
      enabled: true,
    });
    await expect(loadCollector()).resolves.toEqual({
      vpa: 'asha@okhdfcbank',
      name: 'Asha',
      enabled: true,
    });
  });

  it('normalizes the address on the way in', async () => {
    await saveCollector({ vpa: '  Asha@OKSBI ', name: 'Asha', enabled: true });
    const loaded = await loadCollector();
    expect(loaded?.vpa).toBe('asha@oksbi');
  });

  it('keeps the disabled flag', async () => {
    await saveCollector({ vpa: 'asha@oksbi', name: 'Asha', enabled: false });
    const loaded = await loadCollector();
    expect(loaded?.enabled).toBe(false);
  });

  it('discards a stored address that is not a valid VPA', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ vpa: 'not-a-vpa', name: 'Asha' }));
    await expect(loadCollector()).resolves.toBeNull();
  });

  it('survives corrupt json', async () => {
    await AsyncStorage.setItem(KEY, '{oops');
    await expect(loadCollector()).resolves.toBeNull();
  });

  it('clears', async () => {
    await saveCollector({ vpa: 'asha@oksbi', name: 'Asha', enabled: true });
    await clearCollector();
    await expect(loadCollector()).resolves.toBeNull();
  });
});
