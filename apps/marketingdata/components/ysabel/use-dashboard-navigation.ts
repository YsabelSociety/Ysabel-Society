import { useEffect } from 'react';
import type { DashboardJump } from '@/lib/dashboard-navigation';

export function useDashboardNavigation(jump: DashboardJump | null, page: string) {
  useEffect(() => {
    if (!jump || jump.page !== page) return;
    let done = false;
    let frame = 0;
    const find = () => {
      if (done) return;
      const root = document.querySelector(`[data-dashboard-page="${CSS.escape(page)}"]`);
      if (!root) return;
      // The Performance page is retained between visits. Wait until its selected
      // platform has changed before finding an anchor in its previous contents.
      if (page === 'Performance' && !root.querySelector(`.platform-workspace[data-platform="${CSS.escape(jump.channel)}"]`)) return;
      const target = Array.from(root.querySelectorAll<HTMLElement>(`[data-dashboard-metric="${CSS.escape(jump.metric)}"][data-dashboard-channel="${CSS.escape(jump.channel)}"]`))
        .find(element => !element.closest('[hidden]'));
      if (!target) return;
      done = true;
      observer.disconnect();
      frame = requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        target.focus({ preventScroll: true });
      });
    };
    const observer = new MutationObserver(find);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-platform'] });
    find();
    const timeout = window.setTimeout(() => observer.disconnect(), 60000);
    return () => { observer.disconnect(); clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [jump, page]);
}
