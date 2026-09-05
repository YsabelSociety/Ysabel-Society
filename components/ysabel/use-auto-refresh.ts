'use client';
import { useEffect } from 'react';
export function useAutoRefresh(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let running = false;
    async function refresh() {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const response = await fetch('/api/connectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'autoRefresh' }),
          signal: controller.signal,
        });
        if (
          response.ok &&
          ((await response.json()) as { refreshed?: boolean }).refreshed
        )
          window.dispatchEvent(new Event('ysabel:sources-updated'));
      } catch {
      } finally {
        running = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ready]);
}
