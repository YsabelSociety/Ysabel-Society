import { cloneElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { mediaGridWindow } from '@/lib/media-grid-window';

/** Only mount the nearby rows, while retaining a dragged/focused tile until release. */
export default function VirtualMediaGrid<T extends { id: string }>({ items, dock = false, renderItem }: {
  items: T[]; dock?: boolean; renderItem: (item: T) => ReactElement<{ style?: CSSProperties }>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ width: dock ? 308 : 720, viewportHeight: 600, scrollTop: 0, padX: dock ? 9 : 0, padY: dock ? 9 : 0 });
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const gap = dock ? 7 : 13, rowGap = dock ? 7 : 23;
  const layout = mediaGridWindow({ count: items.length, ...metrics, minWidth: dock ? 112 : 150, gap, rowGap, extraHeight: dock ? 0 : 44 });
  const indices = Array.from({ length: layout.end - layout.start }, (_, offset) => layout.start + offset);
  for (const id of [pinnedId, focusedId]) {
    if (!id) continue;
    const index = items.findIndex(item => item.id === id);
    if (index >= 0 && !indices.includes(index)) indices.push(index);
  }
  indices.sort((a, b) => a - b);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const scroller = dock ? node : node.closest<HTMLElement>('.library-page') || node.parentElement!;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const style = getComputedStyle(node);
      const padX = parseFloat(style.paddingLeft) || 0, padY = parseFloat(style.paddingTop) || 0;
      const width = node.clientWidth - padX - (parseFloat(style.paddingRight) || 0);
      if (width <= 0 || scroller.clientHeight <= 0) return;
      const scrollTop = dock ? node.scrollTop : scroller.getBoundingClientRect().top - node.getBoundingClientRect().top;
      const next = { width, viewportHeight: scroller.clientHeight, scrollTop: Math.max(0, scrollTop - padY), padX, padY };
      setMetrics(old => Object.keys(next).every(key => old[key as keyof typeof old] === next[key as keyof typeof next]) ? old : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(node); if (scroller !== node) observer.observe(scroller);
    scroller.addEventListener('scroll', schedule, { passive: true });
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scroller.removeEventListener('scroll', schedule); };
  }, [dock, items.length]);

  useEffect(() => {
    const release = () => setPinnedId(null);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('dragend', release);
    window.addEventListener('drop', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release);
      window.removeEventListener('dragend', release); window.removeEventListener('drop', release); window.removeEventListener('blur', release);
    };
  }, []);
  const itemId = (target: EventTarget) => (target as HTMLElement).closest<HTMLElement>('[data-media-id]')?.dataset.mediaId || null;
  return <div ref={root} className={dock ? 'library-dock-grid' : 'library-grid'} data-virtual-media-grid
    role="list" aria-label={`${items.length} media assets. Scroll to see more.`} tabIndex={dock ? 0 : undefined}
    style={{ position: 'relative', display: 'block', ...(dock ? {} : { height: layout.totalHeight }) }}
    onDragStartCapture={event => setPinnedId(itemId(event.target))}
    onPointerDownCapture={event => { if ((event.target as HTMLElement).closest('.library-touch-drag')) setPinnedId(itemId(event.target)); }}
    onFocusCapture={event => setFocusedId(itemId(event.target))}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null); }}>
    {dock && <div aria-hidden="true" style={{ height: layout.totalHeight, width: 1, pointerEvents: 'none' }} />}
    {indices.map(index => {
      const item = items[index];
      const element = renderItem(item);
      return cloneElement(element, {
        key: item.id, role: 'listitem', 'aria-posinset': index + 1, 'aria-setsize': items.length, 'data-media-id': item.id,
        style: { ...element.props.style, position: 'absolute', left: metrics.padX + (index % layout.columns) * (layout.itemWidth + gap), top: metrics.padY + Math.floor(index / layout.columns) * layout.pitch, width: layout.itemWidth, height: layout.itemHeight },
      } as typeof element.props);
    })}
  </div>;
}
