'use client';
import { useEffect, useState } from 'react';
import { readWithRetry } from '@/lib/read-with-retry';
import { appPath } from '@/lib/app-path';
import { googleRatingHistory, type GoogleRatingObservation } from '@/lib/google-rating-snapshot';

type RatingFeed = GoogleRatingObservation & {
  observedAt: string;
  history: GoogleRatingObservation[];
};

export function useGoogleRatingHistory() {
  const [history, setHistory] = useState(googleRatingHistory);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function update() {
      if (pending) return;
      pending = true;
      try {
        const response = await readWithRetry(appPath('/api/google-rating'), { signal: controller.signal, timeoutMs: 8000 });
        if (!response.ok) return;
        const { rating } = await response.json() as { rating: RatingFeed | null };
        if (!rating || !Array.isArray(rating.history)) return;
        const verified = [...rating.history, rating].filter(r =>
          Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5 &&
          Number.isInteger(r.reviewCount) && r.reviewCount >= 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.date));
        setHistory([...googleRatingHistory.filter(r => !verified.some(h => h.date === r.date)),
          ...verified.map(r => ({ ...r, source: 'Google Business API' }))]);
      } catch { /* Retain dated Google observations if the saved feed is unavailable. */ }
      finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    }
    void update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener('ysabel:sources-updated', update);
    window.addEventListener('ysabel:community-updated', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener('ysabel:sources-updated', update);
      window.removeEventListener('ysabel:community-updated', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return { history, loading };
}
