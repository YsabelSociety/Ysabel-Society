'use client';
import { useEffect } from 'react';
import { appPath } from '@/lib/app-path';

export function useSessionRetention() {
  useEffect(() => {
    let stopped = false, inFlight = false, nextAttempt = 0;
    let activeRequest: AbortController | undefined;
    const renew = async () => {
      if (stopped || document.hidden || inFlight || Date.now() < nextAttempt) return;
      inFlight = true;
      nextAttempt = Date.now() + 5 * 60 * 1000;
      const controller = new AbortController();
      activeRequest = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(appPath('/api/session'), {
          method: 'PATCH',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.ok) nextAttempt = Date.now() + 12 * 60 * 60 * 1000;
      } catch {
        // A temporary network failure must not interrupt the open workspace.
      } finally {
        clearTimeout(timeout);
        activeRequest = undefined;
        inFlight = false;
      }
    };
    void renew();
    const resume = () => { void renew(); };
    const interval = setInterval(resume, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      stopped = true;
      activeRequest?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, []);
}
