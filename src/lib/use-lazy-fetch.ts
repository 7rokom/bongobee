import { useEffect, useRef } from 'react';

/**
 * Run an async fetcher exactly once per page-mount lifetime, on next tick.
 * Useful for admin pages that need Tier-3 data (expenses, deposits, courier
 * dispatch, etc.) that AdminDataInitializer no longer prefetches.
 */
export function useLazyFetch(fetchers: Array<() => Promise<unknown> | void>) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Defer one tick so initial render is not blocked by the request.
    const t = setTimeout(() => {
      Promise.all(fetchers.map((f) => Promise.resolve().then(() => f()))).catch(() => {});
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
