'use client';
import {useEffect} from 'react';
// Separate requests and server leases prevent one platform from blocking the other.
export function useInboxSync(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const active = new Set<string>();
    const continuation = new Map<string, boolean>();
    async function refresh(source: string) {
      if (document.visibilityState !== 'visible' || active.has(source)) return;
      active.add(source);
      try {
        const response = await fetch('/marketingdata/api/community', {method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({op:'auto',source,continue:continuation.get(source) === true}), signal:AbortSignal.any([controller.signal,AbortSignal.timeout(50000)])});
        if (response.ok) { const result = await response.json() as {skipped?: boolean; more?: boolean}; if (!result.skipped) continuation.set(source, result.more === true); }
      } catch { /* The persisted per-platform status is shown in Inbox. */ }
      finally { active.delete(source); if (!controller.signal.aborted) window.dispatchEvent(new Event('ysabel:community-updated')); }
    }
    const update=()=>{void refresh('instagram');void refresh('facebook');};
    update();
    const timer=setInterval(update,60000);
    document.addEventListener('visibilitychange',update);
    return ()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[ready]);
}
