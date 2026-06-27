export function combineSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  const c = new AbortController();
  if (s1.aborted || s2.aborted) { c.abort(); return c.signal; }
  const onAbort = () => c.abort();
  s1.addEventListener('abort', onAbort, { once: true });
  s2.addEventListener('abort', onAbort, { once: true });
  return c.signal;
}
