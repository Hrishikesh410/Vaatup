import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as auth from '@/application/auth-service';
import { materialiseDueExpenses } from '@/application/recurring-service';
import type { Participant } from '@/types/participant';
import type { LoginInput, RegisterInput, User } from '@/types/user';

/**
 * Who is signed in.
 *
 * The provider owns the one asynchronous step every screen depends on: opening
 * the database and restoring the session. Until that finishes the status is
 * `loading`, which is what stops the app flashing a sign-in screen at someone
 * who is already signed in.
 */

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: SessionStatus;
  user: User | null;
  /** The participant row that represents the user in their own expenses. */
  self: Participant | null;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (changes: auth.ProfileChanges) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<auth.Session | null>(null);

  const apply = useCallback((next: auth.Session | null) => {
    setSession(next);
    setStatus(next ? 'signedIn' : 'signedOut');
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const restored = await auth.restoreSession();
        if (!active) return;
        apply(restored);

        // Anything that came due while the app was closed is created now, once
        // we know who is signed in.
        if (restored) await materialiseDueExpenses(restored.user.id);
      } catch {
        // A failure here means no session, not a broken app: the sign-in screen
        // is a working state.
        if (active) apply(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [apply]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user: session?.user ?? null,
      self: session?.self ?? null,
      signIn: async (input) => apply(await auth.login(input)),
      signUp: async (input) => apply(await auth.register(input)),
      signOut: async () => {
        await auth.logout();
        apply(null);
      },
      updateProfile: async (changes) => {
        if (!session) return;
        apply(await auth.updateProfile(session.user.id, changes));
      },
    }),
    [status, session, apply]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/**
 * The signed-in user, for screens that are only reachable behind the auth gate.
 * Throwing here turns "the gate is broken" into an obvious failure rather than
 * a screen quietly rendering someone else's data.
 */
export function useCurrentUser(): { user: User; self: Participant } {
  const { user, self } = useSession();
  if (!user || !self) throw new Error('This screen requires a signed-in user');
  return { user, self };
}
