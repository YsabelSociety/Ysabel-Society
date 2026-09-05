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
        for (let account = 0; account < 8; account++) {
          if (
            controller.signal.aborted ||
            document.visibilityState !== 'visible'
          )
            break;
          const response = await fetch('/api/connectors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'autoRefresh' }),
            signal: controller.signal,
          });
          if (!response.ok) break;
          const result = (await response.json()) as {
            refreshed?: boolean;
            more?: boolean;
            needsAttention?: boolean;
          };
          if (result.refreshed || result.needsAttention)
            window.dispatchEvent(new Event('ysabel:sources-updated'));
          if (!result.more) break;
        }
        for (const source of ['facebook', 'instagram', 'gbp']) {
          if (
            controller.signal.aborted ||
            document.visibilityState !== 'visible'
          )
            break;
          await fetch('/api/community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'auto', source }),
            signal: controller.signal,
          });
        }
        window.dispatchEvent(new Event('ysabel:community-updated'));
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
