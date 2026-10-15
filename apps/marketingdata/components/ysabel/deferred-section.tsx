'use client';
import { lazy, Suspense, type ComponentType, type ComponentProps } from 'react';

/** Load section code on demand; the section's visuals and motion stay intact. */
export function deferredSection<T extends ComponentType<any>>(name: string, load: () => Promise<{ default: T }>) {
  const Section = lazy(load);
  return function DeferredSection(props: ComponentProps<T>) {
    return <Suspense fallback={<p role="status" className="muted">Opening {name}…</p>}><Section {...props as any}/></Suspense>;
  };
}
