import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * A single "something changed" signal.
 *
 * Screens read from the database through hooks, and an expense written on one
 * screen changes the balances shown on three others. Rather than pull in a
 * caching library for a local database that answers in microseconds, every
 * mutation bumps a revision and the hooks re-read.
 */

interface RefreshValue {
  revision: number;
  /** Call after any write, so screens reading derived data reload. */
  refresh: () => void;
}

const RefreshContext = createContext<RefreshValue | null>(null);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const value = useMemo(() => ({ revision, refresh }), [revision, refresh]);

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh(): RefreshValue {
  const value = useContext(RefreshContext);
  if (!value) throw new Error('useRefresh must be used inside <RefreshProvider>');
  return value;
}
