import { listExpenses } from '@/application/expense-service';
import { useSession } from '@/state/session';
import { hasFinishedOnboarding, markOnboardingFinished } from '@/storage/onboarding';

import { useAsync } from './use-async';

/**
 * Whether this account still needs the first-bill screen.
 *
 * `unknown` is the honest answer until storage has been read. A gate that
 * guessed would either flash the tabs at someone who has never used the app or
 * the first-bill screen at someone who has been splitting bills for months.
 */
export type OnboardingStatus = 'unknown' | 'needed' | 'done';

async function resolveStatus(userId: string): Promise<OnboardingStatus> {
  if (await hasFinishedOnboarding(userId)) return 'done';

  // An account with expenses was already here before this screen existed.
  // Recording that now means the database is only asked once per account.
  const existing = await listExpenses(userId, { limit: 1 });
  if (existing.length === 0) return 'needed';

  await markOnboardingFinished(userId);
  return 'done';
}

export function useOnboardingStatus(): OnboardingStatus {
  const userId = useSession().user?.id ?? '';

  // Signed out there is nobody to introduce, and the auth gate is already on
  // its way to the sign-in screen.
  const { data } = useAsync<OnboardingStatus>(
    () => (userId === '' ? Promise.resolve('done') : resolveStatus(userId)),
    `onboarding:${userId}`,
    'unknown'
  );

  return data;
}
