/**
 * Stale-while-revalidate helper for one-shot async fetches.
 * Prevents duplicate inflight requests and skips re-fetching while
 * data is considered fresh (default 60s window).
 */
const inflight = new Map<string, Promise<any>>();
const lastRun = new Map<string, number>();

export async function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  freshMs = 5 * 60_000
): Promise<T | undefined> {
  const now = Date.now();
  const last = lastRun.get(key) || 0;
  if (now - last < freshMs && !inflight.has(key)) {
    return undefined; // recently fetched — caller already has fresh state
  }
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;
  const p = fn().finally(() => {
    lastRun.set(key, Date.now());
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

export function invalidateCache(key: string) {
  lastRun.delete(key);
  inflight.delete(key);
}

/** Schedule callback in idle time, falling back to setTimeout. */
export function runIdle(cb: () => void, timeout = 2000) {
  const w = window as any;
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, 200);
  }
}
