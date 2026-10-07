/** Retry saved-data reads after a temporary outage; successful reads have no delay. */
export async function readWithRetry(
  url: string,
  { signal, timeoutMs = 30000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Response> {
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal?.throwIfAborted();
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      });
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1)
        return response;
      await response.body?.cancel();
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt === attempts - 1 || !(error instanceof TypeError ||
        error instanceof DOMException && error.name === 'TimeoutError')) throw error;
    }
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal!.reason); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 1000 * 2 ** attempt);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
  throw new Error('Data is temporarily unavailable.');
}
