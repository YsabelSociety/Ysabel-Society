'use client';
import { useEffect, useRef, useState } from 'react';
import { appPath } from '@/lib/app-path';
import type { RefreshJob } from '@/lib/refresh-types';

export function useAutoRefresh(ready: boolean, timezone = 'Europe/Tirane') {
  const [running, setRunning] = useState(false);
  const [foreground, setForeground] = useState(false);
  const [foregroundLeaving, setForegroundLeaving] = useState(false);
  const [status, setStatus] = useState('');
  const [lastChecked, setLastChecked] = useState<string>();
  const [job, setJob] = useState<RefreshJob | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const refreshRef = useRef<
    (force: boolean, showForeground?: boolean) => Promise<void>
  >(async () => {});
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let active = false;
    let activeForeground = false;
    let foregroundDeadline: ReturnType<typeof setTimeout> | undefined;
    let foregroundExit: ReturnType<typeof setTimeout> | undefined;
    const finishForeground = () => {
      if (!activeForeground) return;
      activeForeground = false;
      if (foregroundDeadline) clearTimeout(foregroundDeadline);
      setForegroundLeaving(true);
      foregroundExit = setTimeout(() => {
        if (controller.signal.aborted) return;
        setForeground(false);
        setForegroundLeaving(false);
      }, 420);
    };
    const publish = (next: RefreshJob) => {
      setJob(next);
      if (next.status === 'running')
        setStatus(
          next.completed +
            '/' +
            next.tasks.length +
            ' checked · ' +
            (next.current || 'Finishing import') +
            '…',
        );
      else {
        setLastChecked(next.updatedAt);
        setStatus(
          next.status === 'partial'
            ? 'Available data updated · some sources need attention. View sync details.'
            : 'Connected sources updated',
        );
      }
    };
    let reportedJob = '',
      communityJob = '';
    const updated = (next: RefreshJob) => {
      // Message pagination does not change analytics. Publish reports once when
      // their phase finishes, then community records when the run finishes.
      if (
        next.id !== reportedJob &&
        next.tasks.every(
          (task) => task.kind !== 'reports' || task.state !== 'pending',
        )
      ) {
        reportedJob = next.id;
        window.dispatchEvent(new Event('ysabel:sources-updated'));
      }
      if (next.id !== communityJob && next.status !== 'running') {
        communityJob = next.id;
        window.dispatchEvent(new Event('ysabel:community-updated'));
      }
    };
    async function call(body: object): Promise<RefreshJob> {
      const response = await fetch(appPath('/api/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(65000),
        ]),
      });
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new Error(
          'Import is taking longer than expected. Progress is saved; Sync now resumes it.',
        );
      const result = (await response.json()) as RefreshJob & { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'Refresh could not complete.');
      return result;
    }
    async function refresh(force = false, showForeground = false) {
      if (
        active ||
        controller.signal.aborted ||
        (!force && document.visibilityState !== 'visible')
      )
        return;
      active = true;
      if (showForeground) {
        if (foregroundExit) clearTimeout(foregroundExit);
        activeForeground = true;
        setForeground(true);
        setForegroundLeaving(false);
        foregroundDeadline = setTimeout(finishForeground, 15000);
      }
      setRunning(true);
      setStatus('Starting online import…');
      try {
        const metadata = await fetch(appPath('/api/refresh'), {
          cache: 'no-store',
          signal: controller.signal,
        })
          .then((r) =>
            r.ok ? (r.json() as Promise<{ schedule: string | null }>) : null,
          )
          .catch(() => null);
        if (metadata) setSchedule(metadata.schedule);
        let next = await call({ op: 'start', force });
        publish(next);
        let failures = 0;
        for (let step = 0; next.status === 'running' && step < 240; step++) {
          if (controller.signal.aborted) return;
          if (next.retryAfter)
            await new Promise((resolve) => setTimeout(resolve, 3000));
          try {
            next = await call({ op: 'step', id: next.id });
            failures = 0;
            publish(next);
            updated(next);
          } catch (error) {
            if (controller.signal.aborted) return;
            if (++failures >= 3) throw error;
            setStatus('Retrying import · saved progress is retained…');
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
        if (next.status === 'running')
          setStatus('Import progress saved. Use Sync now to continue.');
        updated(next);
      } catch (error) {
        if (!controller.signal.aborted)
          setStatus(
            error instanceof Error
              ? error.message
              : 'Sync needs attention. Try again.',
          );
      } finally {
        active = false;
        if (!controller.signal.aborted) {
          setRunning(false);
          if (showForeground) finishForeground();
        }
      }
    }
    refreshRef.current = refresh;
    void refresh(true);
    const timer = setInterval(() => void refresh(), 5 * 60 * 1000);
    const visible = () => void refresh();
    const manual = () => void refresh(true, true);
    const rendered = () => finishForeground();
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('ysabel:sync-now', manual);
    window.addEventListener('ysabel:sources-rendered', rendered);
    return () => {
      controller.abort();
      if (foregroundDeadline) clearTimeout(foregroundDeadline);
      if (foregroundExit) clearTimeout(foregroundExit);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('ysabel:sync-now', manual);
      window.removeEventListener('ysabel:sources-rendered', rendered);
    };
  }, [ready, timezone]);
  return {
    running,
    foreground,
    foregroundLeaving,
    status,
    lastChecked,
    job,
    schedule,
    sync: () => refreshRef.current(true, true),
  };
}
