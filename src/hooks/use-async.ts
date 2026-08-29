import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFor } from '@/domain/errors';
import { useRefresh } from '@/state/refresh';

/**
 * Reads something from the application layer and keeps it in step.
 *
 * The loader is identified by a `key` string rather than a dependency array, so
 * a caller can express "reload when the group filter changes" without the hook
 * having to compare functions. Reloads also happen whenever anything in the app
 * writes data — see `state/refresh`.
 */

export interface AsyncState<T> {
  data: T;
  /** True until the data on hand matches what is currently being asked for. */
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface LoadedState<T> {
  /** Which request produced this data, so a stale answer is recognisable. */
  requestId: string;
  data: T;
  error: string | null;
}

export function useAsync<T>(loader: () => Promise<T>, key: string, initial: T): AsyncState<T> {
  const [loaded, setLoaded] = useState<LoadedState<T>>({
    requestId: '',
    data: initial,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const { revision } = useRefresh();

  const requestId = `${key}|${revision}|${attempt}`;

  // The loader closes over props that change every render; keeping it in a ref
  // means only the request id decides when to re-read. This effect is declared
  // first so the ref is current before the load below runs.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const result = await loaderRef.current();
        if (active) setLoaded({ requestId, data: result, error: null });
      } catch (caught) {
        // Keep whatever was on screen; an error banner beats blanking the list.
        if (active) {
          setLoaded((current) => ({
            requestId,
            data: current.data,
            error: messageFor(caught, 'Could not load that.'),
          }));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [requestId]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  return {
    data: loaded.data,
    loading: loaded.requestId !== requestId,
    error: loaded.error,
    reload,
  };
}
