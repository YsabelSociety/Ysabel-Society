'use client';
import { BrandLogo } from '@/components/ysabel/brand-logo';

import { RefreshCw } from 'lucide-react';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main
      className="workspace"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
    >
      <div className="surface padded" style={{ maxWidth: 450, margin: 24 }}>
        <BrandLogo />
        <h1 style={{ fontSize: 27, marginTop: 35 }}>A moment to reconnect.</h1>
        <p className="muted panel-description">
          This view could not load. Your saved workspace is still available; try
          opening it again.
        </p>
        <button className="secondary" style={{ marginTop: 25 }} onClick={reset}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </main>
  );
}
