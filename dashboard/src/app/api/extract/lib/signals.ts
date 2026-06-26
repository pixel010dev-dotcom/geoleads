export function combineSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  const c = new AbortController();
  const abort = () => c.abort();
  s1.addEventListener('abort', abort, { once: true });
  s2.addEventListener('abort', abort, { once: true });
  return c.signal;
}
