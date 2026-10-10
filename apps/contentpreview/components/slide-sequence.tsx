import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, GripHorizontal, Minus, Plus, Rows3, X } from 'lucide-react';
import { moveSequenceSlide, sequenceEdgeSpeed } from '@/lib/slide-sequence';

type Item = { id: string; name: string };
type Drag = { pointerId: number; id: string; startX: number; startY: number; x: number; y: number; active: boolean; order: string[]; original: string[]; ghost: HTMLElement | null };

export default function SlideSequence({ items, selectedId, onSelect, onReorder, onRemove, renderMedia }: {
  items: Item[]; selectedId: string; onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void; onRemove: (id: string) => void; renderMedia: (id: string) => ReactNode;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const callbacks = useRef({ onReorder, onSelect });
  const previousRects = useRef(new Map<string, DOMRect>());
  const suppressClick = useRef(0);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const [size, setSize] = useState(144);
  const [announcement, setAnnouncement] = useState('');
  const order = draft || items.map(item => item.id);
  const membership = items.map(item => item.id).sort().join('|');
  useLayoutEffect(() => { callbacks.current = { onReorder, onSelect }; }, [onReorder, onSelect]);
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    strip.current?.querySelectorAll<HTMLElement>('[data-sequence-id]').forEach(card => {
      const id = card.dataset.sequenceId!;
      const rect = card.getBoundingClientRect();
      const old = previousRects.current.get(id);
      if (old && id !== dragging && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const x = old.left - rect.left, y = old.top - rect.top;
        if (Math.abs(x) > 1 || Math.abs(y) > 1) card.animate?.([{ transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0,0)' }], { duration: 170, easing: 'ease-out' });
      }
      next.set(id, rect);
    });
    previousRects.current = next;
  }, [order.join('|')]);

  useEffect(() => {
    let frame = 0;
    setDraft(null); setDragging(null);
    const cleanupDrag = () => {
      cancelAnimationFrame(frame); frame = 0;
      drag.current?.ghost?.remove(); drag.current = null;
    };
    const finish = (commit: boolean) => {
      const current = drag.current;
      if (!current) return;
      if (current.active) {
        suppressClick.current = Date.now() + 300;
        if (commit && current.order.join('|') !== current.original.join('|')) {
          callbacks.current.onReorder(current.order);
          setAnnouncement(`Slide moved to position ${current.order.indexOf(current.id) + 1}.`);
        }
        if (commit) callbacks.current.onSelect(current.id);
      }
      cleanupDrag(); setDraft(null); setDragging(null);
    };
    const tick = () => {
      const current = drag.current, node = strip.current;
      if (!current?.active || !node) return;
      if (current.ghost) current.ghost.style.transform = `translate3d(${current.x + 14}px,${current.y + 14}px,0)`;
      const bounds = node.getBoundingClientRect();
      if (current.y >= bounds.top && current.y <= bounds.bottom && current.x >= bounds.left && current.x <= bounds.right) {
        node.scrollLeft += sequenceEdgeSpeed(current.x, bounds.left, bounds.right);
        if (node.scrollHeight > node.clientHeight) node.scrollTop += sequenceEdgeSpeed(current.y, bounds.top, bounds.bottom);
        const target = document.elementFromPoint(current.x, current.y)?.closest<HTMLElement>('[data-sequence-id]');
        if (target && node.contains(target)) {
          const targetId = target.dataset.sequenceId!;
          const targetIndex = current.order.indexOf(targetId);
          const from = current.order.indexOf(current.id);
          const rect = target.getBoundingClientRect();
          // Cross the middle of a neighbour before moving; prevents oscillation.
          const below = Math.abs(rect.top - (node.querySelector<HTMLElement>(`[data-sequence-id="${CSS.escape(current.id)}"]`)?.getBoundingClientRect().top || 0)) > 20;
          const crossed = below || (from < targetIndex ? current.x > rect.left + rect.width / 2 : current.x < rect.left + rect.width / 2);
          if (targetIndex > 0 && targetId !== current.id && crossed) {
            previousRects.current = new Map(Array.from(node.querySelectorAll<HTMLElement>('[data-sequence-id]')).map(card => [card.dataset.sequenceId!, card.getBoundingClientRect()]));
            const next = moveSequenceSlide(current.order, current.id, targetIndex);
            current.order = next; setDraft(next);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      current.x = event.clientX; current.y = event.clientY;
      if (!current.active) {
        if (Math.hypot(current.x - current.startX, current.y - current.startY) < 7) return;
        current.active = true; setDragging(current.id); setDraft(current.order);
        const card = strip.current?.querySelector<HTMLElement>(`[data-sequence-id="${CSS.escape(current.id)}"]`);
        if (card) {
          current.ghost = card.cloneNode(true) as HTMLElement;
          current.ghost.className = 'sequence-drag-ghost';
          current.ghost.style.width = `${Math.min(card.offsetWidth, 160)}px`;
          current.ghost.setAttribute('aria-hidden', 'true'); current.ghost.inert = true;
          document.body.appendChild(current.ghost);
        }
        frame = requestAnimationFrame(tick);
      }
      event.preventDefault();
    };
    const end = (event: PointerEvent) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      const rect = strip.current?.getBoundingClientRect();
      const inside = rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      finish(event.type === 'pointerup' && Boolean(inside));
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); finish(false); }
    };
    const cancel = () => finish(false);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', key, true); window.addEventListener('blur', cancel);
    return () => {
      cleanupDrag();
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end); window.removeEventListener('keydown', key, true); window.removeEventListener('blur', cancel);
    };
  }, [membership]);

  useEffect(() => {
    const node = strip.current;
    if (!node || dragging) return;
    const card = node.querySelector<HTMLElement>(`[data-sequence-id="${CSS.escape(selectedId)}"]`);
    if (!card) return;
    const area = node.getBoundingClientRect(), rect = card.getBoundingClientRect();
    const left = rect.left < area.left ? rect.left - area.left - 3 : rect.right > area.right ? rect.right - area.right + 3 : 0;
    const top = overview ? rect.top < area.top ? rect.top - area.top : rect.bottom > area.bottom ? rect.bottom - area.bottom : 0 : 0;
    if (left || top) node.scrollBy({ left, top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [selectedId, overview, dragging]);

  const begin = (event: ReactPointerEvent, id: string, handle = false) => {
    if (!event.isPrimary || event.button !== 0 || id === order[0] || (!handle && event.pointerType !== 'mouse')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, id, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, order: [...order], original: [...order], ghost: null };
  };
  const nudge = (id: string, direction: number) => {
    const next = moveSequenceSlide(order, id, order.indexOf(id) + direction);
    if (next === order) return;
    onReorder(next); onSelect(id); setAnnouncement(`Slide moved to position ${next.indexOf(id) + 1}.`);
  };
  const scroll = (direction: number) => strip.current?.scrollBy({ left: direction * strip.current.clientWidth * .75, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <div className="slide-sequence">
    <div className="sequence-tools">
      <div className="sequence-view-toggle" aria-label="Slide layout"><button type="button" aria-pressed={!overview} onClick={() => setOverview(false)}><Rows3 />Filmstrip</button><button type="button" aria-pressed={overview} onClick={() => setOverview(true)}><Grid3X3 />All slides</button></div>
      <div className="sequence-size"><span>Size</span><button type="button" aria-label="Smaller slide thumbnails" disabled={size <= 120} onClick={() => setSize(value => value - 24)}><Minus /></button><button type="button" aria-label="Larger slide thumbnails" disabled={size >= 240} onClick={() => setSize(value => value + 24)}><Plus /></button></div>
      {!overview && <div className="sequence-scroll-buttons"><button type="button" aria-label="Scroll slides left" onClick={() => scroll(-1)}><ChevronLeft /></button><button type="button" aria-label="Scroll slides right" onClick={() => scroll(1)}><ChevronRight /></button></div>}
    </div>
    <div ref={strip} className={`sequence-strip${overview ? ' sequence-strip--overview' : ''}${dragging ? ' is-reordering' : ''}`} style={{ '--slide-size': `${size}px` } as CSSProperties} role="list" aria-label="Post slides in order" onDragStart={event => event.preventDefault()} onClickCapture={event => { if (Date.now() < suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}>
      {order.map((id, index) => {
        const item = items.find(item => item.id === id);
        if (!item) return null;
        return <article role="listitem" key={id} data-sequence-id={id} className={`sequence-card${selectedId === id ? ' is-selected' : ''}${dragging === id ? ' is-dragging' : ''}`}>
          <button className="sequence-thumbnail" type="button" aria-label={`Preview slide ${index + 1}: ${item.name}`} aria-pressed={selectedId === id} onClick={() => onSelect(id)} onPointerDown={event => begin(event, id)}>{renderMedia(id)}<span className="sequence-number">{String(index + 1).padStart(2, '0')}{index === 0 && ' · Cover'}</span></button>
          {index > 0 && <button className="sequence-remove" type="button" aria-label={`Remove slide ${index + 1}: ${item.name}`} title="Remove from post only" onClick={() => onRemove(id)}><X /></button>}
          <div className="sequence-card-footer">
            {index === 0 ? <span className="sequence-cover-note">Cover stays first</span> : <>
              <button type="button" aria-label={`Move slide ${index + 1} left`} disabled={index === 1} onClick={() => nudge(id, -1)}><ChevronLeft /></button>
              <button className="sequence-drag-handle" type="button" aria-label={`Drag slide ${index + 1} to reorder. Arrow keys also move it.`} title="Drag to reorder" onPointerDown={event => begin(event, id, true)} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); nudge(id, event.key === 'ArrowLeft' ? -1 : 1); } }}><GripHorizontal /></button>
              <button type="button" aria-label={`Move slide ${index + 1} right`} disabled={index === order.length - 1} onClick={() => nudge(id, 1)}><ChevronRight /></button>
            </>}
          </div>
        </article>;
      })}
    </div>
    <p className="sequence-hint">Drag an image to reorder. On touch, swipe the row to browse and drag its grip to move. The cover stays first.</p>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
