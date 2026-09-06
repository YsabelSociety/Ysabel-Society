'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';

// One observer for the whole collection. Clipping ancestors (the phone and dock)
// are respected, unlike native lazy loading's large, browser-dependent margin.
let observer: IntersectionObserver | undefined;
const visibleCallbacks = new Map<Element, (visible: boolean) => void>();
export function useMediaVisibility(defer: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(!defer);
  useEffect(() => {
    const node = ref.current;
    if (!defer || !node) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    observer ||= new IntersectionObserver((entries) => {
      for (const entry of entries) visibleCallbacks.get(entry.target)?.(entry.isIntersecting);
    }, { rootMargin: '120px' });
    visibleCallbacks.set(node, setVisible);
    observer.observe(node);
    return () => { visibleCallbacks.delete(node); observer?.unobserve(node); };
  }, [defer]);
  return { ref, visible: !defer || visible };
}

type LoadJob = { source: string; resolve: (url: string) => void; reject: (error: Error) => void; consumers: number; promise: Promise<string>; cancel?: () => void };
const pending = new Map<string, LoadJob>();
const decoded = new Set<string>();
const queue: LoadJob[] = [];
let running = 0;

function pump() {
  while (running < 6 && queue.length) {
    const job = queue.shift()!;
    running++;
    const image = new Image();
    image.decoding = 'async';
    const timer = window.setTimeout(() => finish(false), 20000);
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      pending.delete(job.source);
      if (ok) {
        decoded.add(job.source);
        if (decoded.size > 256) decoded.delete(decoded.values().next().value!);
        job.resolve(job.source);
      } else { image.src = ''; job.reject(new Error('Preview unavailable')); }
      running--;
      pump();
    };
    job.cancel = () => finish(false);
    image.onload = () => { void image.decode().catch(() => undefined).then(() => finish(true)); };
    image.onerror = () => finish(false);
    image.src = job.source;
  }
}

export function loadPreview(source: string, priority = false, signal?: AbortSignal) {
  if (decoded.has(source)) return Promise.resolve(source);
  if (signal?.aborted) return Promise.reject(new Error('Preview cancelled'));
  let job = pending.get(source);
  if (job) {
    const index = queue.findIndex((job) => job.source === source);
    if (priority && index > 0) queue.unshift(queue.splice(index, 1)[0]);
  } else {
    let resolve!: LoadJob['resolve'];
    let reject!: LoadJob['reject'];
    const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
    job = { source, resolve, reject, promise, consumers: 0 };
    pending.set(source, job);
    if (priority) queue.unshift(job); else queue.push(job);
  }
  const current = job;
  current.consumers++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    signal?.removeEventListener('abort', release);
    current.consumers--;
    if (!current.consumers && pending.get(source) === current) {
      const index = queue.indexOf(current);
      if (index >= 0) {
        queue.splice(index, 1);
        pending.delete(source);
        current.reject(new Error('Preview cancelled'));
      } else current.cancel?.();
    }
  };
  signal?.addEventListener('abort', release, { once: true });
  void current.promise.then(release, release);
  pump();
  return current.promise;
}

export function ProgressiveImage({ thumbnail, display, alt, style, recover }: {
  thumbnail: string; display?: string; alt: string; style: CSSProperties;
  recover: () => Promise<{ thumbnail: string; display: string } | null>;
}) {
  const [source, setSource] = useState(decoded.has(thumbnail) ? thumbnail : '');
  const [failed, setFailed] = useState(false);
  const recovery = useRef(recover);
  recovery.current = recover;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setFailed(false);
    setSource(decoded.has(thumbnail) ? thumbnail : '');
    void (async () => {
      let thumbnailReady = false;
      try {
        await loadPreview(thumbnail, Boolean(display), controller.signal);
        thumbnailReady = true;
        if (cancelled) return;
        setSource(thumbnail);
      } catch { /* Older uploads are repaired below, with bounded concurrency. */ }
      if (cancelled) return;
      if (display && display !== thumbnail) {
        try {
          await loadPreview(display, true, controller.signal);
          if (!cancelled) setSource(display);
          return;
        } catch { /* Keep the thumbnail visible during repair. */ }
      } else if (thumbnailReady) return;
      if (cancelled) return;
      const urls = await recovery.current();
      if (cancelled) return;
      if (urls) setSource(display ? urls.display : urls.thumbnail);
      else if (!thumbnailReady) setFailed(true);
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [thumbnail, display]);
  return <>{source && <img className="asset-media" src={source} alt={alt} style={style} draggable={false} decoding="async" />}
    {failed && <span className="media-load-error">Preview unavailable</span>}</>;
}
