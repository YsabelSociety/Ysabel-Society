/** Shared pointer lifecycle for whole-post movement, independent of slide contents. */
export type FeedDragSource = { type: 'grid' | 'library'; index?: number; id?: string };
export type FeedPointerDrag = { source: FeedDragSource; pointerId: number; startX: number; startY: number; active: boolean };
type Ref<T> = { current: T };

export function bindFeedPointerDrag({ pointerDrag, suppressDragClickUntil, edit, applyDrop, highlightDrop, clearDropHighlight }: {
  pointerDrag: Ref<FeedPointerDrag | null>;
  suppressDragClickUntil: Ref<number>;
  edit: boolean;
  applyDrop: (source: FeedDragSource, target: number) => void;
  highlightDrop: (node: Element | null) => void;
  clearDropHighlight: () => void;
}) {
  const targetAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-feed-index]');
    const value = element?.dataset.feedIndex;
    return value === undefined ? null : Number(value);
  };
  let ghost: HTMLElement | null = null;
  let origin: HTMLElement | null = null;
  let frame = 0;
  let x = 0, y = 0;
  const cleanup = () => { cancelAnimationFrame(frame); ghost?.remove(); ghost = null; origin?.classList.remove('is-drag-origin'); origin = null; clearDropHighlight(); };
  const tick = () => {
    if (!pointerDrag.current?.active) return;
    if (ghost) ghost.style.transform = `translate3d(${x + 14}px, ${y + 14}px, 0)`;
    const hit = document.elementFromPoint(x, y);
    highlightDrop(hit);
    let scroll = hit?.parentElement;
    while (scroll) {
      if (scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY)) {
        const rect = scroll.getBoundingClientRect();
        const edge = Math.min(56, rect.height / 4);
        const delta = y < rect.top + edge ? -8 : y > rect.bottom - edge ? 8 : 0;
        scroll.scrollTop += delta;
        break;
      }
      scroll = scroll.parentElement;
    }
    frame = requestAnimationFrame(tick);
  };
  const move = (event: PointerEvent) => {
    const current = pointerDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.active && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 9) return;
    x = event.clientX; y = event.clientY;
    if (!current.active) {
      current.active = true;
      origin = document.elementFromPoint(current.startX, current.startY)?.closest<HTMLElement>('.feed-tile-wrap, .library-dock-asset') || null;
      const tile = origin?.querySelector<HTMLElement>('.feed-tile') || origin;
      if (tile) {
        ghost = tile.cloneNode(true) as HTMLElement;
        ghost.className = 'post-drag-ghost';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.removeAttribute('id');
        document.body.appendChild(ghost);
        // cloneNode does not retain the visible carousel slide's scroll offset.
        const tracks = tile.querySelectorAll<HTMLElement>('.carousel-track');
        ghost.querySelectorAll<HTMLElement>('.carousel-track').forEach((track, index) => {
          const source = tracks[index];
          track.scrollLeft = source?.clientWidth ? (source.scrollLeft / source.clientWidth) * track.clientWidth : 0;
        });
        origin?.classList.add('is-drag-origin');
      }
      frame = requestAnimationFrame(tick);
    }
    event.preventDefault();
    highlightDrop(document.elementFromPoint(event.clientX, event.clientY));
  };
  const end = (event: PointerEvent) => {
    const current = pointerDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const target = targetAt(event.clientX, event.clientY);
    if (current.active) suppressDragClickUntil.current = Date.now() + 250;
    cleanup();
    if (edit && event.type !== 'pointercancel' && current.active && target !== null) applyDrop(current.source, target);
    pointerDrag.current = null;
    clearDropHighlight();
  };
  const preventDragClick = (event: MouseEvent) => { if (Date.now() < suppressDragClickUntil.current) { event.preventDefault(); event.stopPropagation(); } };
  window.addEventListener('click', preventDragClick, true);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  return () => {
    cleanup();
    pointerDrag.current = null;
    window.removeEventListener('click', preventDragClick, true);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
}

