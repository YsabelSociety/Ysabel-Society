'use client';
import { useEffect } from 'react';
import { internalLinkEvent } from '@/lib/website-link-event';

export default function WebsiteLinkTracking() {
  useEffect(() => {
    const track = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;
      const params = internalLinkEvent(anchor.getAttribute('href') || '', window.location.href);
      const gtag = (window as Window & { gtag?: (command: string, event: string, params: object) => void }).gtag;
      if (params && gtag) gtag('event', 'link_click', params);
    };
    // Next Link handles navigation by cancelling the bubbling native event.
    // Observe the click before that interception, without delaying navigation.
    document.addEventListener('click', track, { capture: true, passive: true });
    return () => document.removeEventListener('click', track, true);
  }, []);
  return null;
}
