'use client';
import { useEffect, useRef, useState } from 'react';
import { SOURCE_CHANNELS } from '@/lib/connector-catalog';

export function useAutoRefresh(ready: boolean, timezone = 'Europe/Tirane') {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [lastChecked, setLastChecked] = useState<string>();
  const refreshRef = useRef<(force: boolean) => Promise<void>>(async () => {});
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let active = false;
    async function refresh(force = false) {
      if (
        active ||
        controller.signal.aborted ||
        document.visibilityState !== 'visible'
      )
        return;
      active = true;
      setRunning(true);
      setStatus('Checking connected platforms…');
      const excluded: string[] = [],
        issues: string[] = [];
      let updated = 0;
      try {
        for (let account = 0; account < 8; account++) {
          if (controller.signal.aborted) return;
          const response = await fetch('/marketingdata/api/connectors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              op: 'autoRefresh',
              force,
              exclude: excluded,
              timezone,
            }),
            signal: controller.signal,
          });
          if (
            !response.headers.get('content-type')?.includes('application/json')
          )
            throw new Error(
              'A platform took too long. Saved reports are still available; use Sync now to retry.',
            );
          const result = (await response.json()) as {
            source?: string;
            error?: string;
            needsAttention?: boolean;
            refreshed?: boolean;
            more?: boolean;
          };
          if (!response.ok)
            throw new Error(
              result.error || 'Could not refresh connected platforms.',
            );
          if (result.source) {
            excluded.push(result.source);
            const label = SOURCE_CHANNELS[result.source] || result.source;
            setStatus('Checked ' + label + ' · continuing…');
            if (result.needsAttention) issues.push(label);
            if (result.refreshed) updated++;
          }
          if (result.refreshed || result.needsAttention)
            window.dispatchEvent(new Event('ysabel:sources-updated'));
          if (!result.more) break;
        }
        const tasks = [
          { source: 'facebook' },
          { source: 'instagram' },
          { source: 'tiktok' },
          { source: 'gbp' },
          { source: 'facebook', kind: 'mention' },
          { source: 'instagram', kind: 'mention' },
          { source: 'tiktok', kind: 'mention' },
        ];
        for (const task of tasks) {
          if (controller.signal.aborted) return;
          setStatus('Checking messages, mentions and reviews…');
          const response = await fetch('/marketingdata/api/community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'auto', force, ...task }),
            signal: controller.signal,
          });
          const result = (await response.json()) as {
            needsAttention?: boolean;
          };
          if (!response.ok || result.needsAttention)
            issues.push(SOURCE_CHANNELS[task.source] + ' community');
        }
        if (!controller.signal.aborted) {
          window.dispatchEvent(new Event('ysabel:community-updated'));
          window.dispatchEvent(new Event('ysabel:sources-updated'));
          setLastChecked(new Date().toISOString());
          setStatus(
            issues.length
              ? 'Updated available reports · check ' +
                  [...new Set(issues)].join(', ') +
                  ' in Connections.'
              : updated
                ? 'Latest available reports updated'
                : 'Connected sources checked',
          );
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setStatus(
            error instanceof Error
              ? error.message
              : 'Sync needs attention. Try again.',
          );
      } finally {
        active = false;
        if (!controller.signal.aborted) setRunning(false);
      }
    }
    refreshRef.current = refresh;
    void refresh(true);
    const timer = setInterval(() => void refresh(), 5 * 60 * 1000);
    const visible = () => void refresh();
    const manual = () => void refresh(true);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('ysabel:sync-now', manual);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('ysabel:sync-now', manual);
    };
  }, [ready, timezone]);
  return { running, status, lastChecked, sync: () => refreshRef.current(true) };
}
