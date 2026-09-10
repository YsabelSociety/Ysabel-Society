import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import './gallery-viewer.css';

export default function GalleryViewer({ name, source, preview, video, onClose, onPrevious, onNext, onDetails }: {
  name: string; source: string; preview: string; video?: ReactNode;
  onClose: () => void; onPrevious: () => void; onNext: () => void; onDetails: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const clamp = (value: number) => Math.min(5, Math.max(1, value));
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  useEffect(() => {
    const element = stage.current;
    if (!element || video) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); setZoom(value => clamp(value * Math.exp(-event.deltaY * .002))); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [video]);
  useEffect(() => { if (zoom === 1) setPan({ x: 0, y: 0 }); }, [zoom]);
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="gallery-viewer" onKeyDown={event => {
    if ((event.target as HTMLElement).closest('button,input,video')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); onPrevious(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); onNext(); }
  }}><DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{video ? 'Play and inspect before placing in your feed.' : 'Scroll or pinch to zoom · Drag to explore · Double-click to reset'}</DialogDescription></DialogHeader>
    <div ref={stage} className={`gallery-viewer-stage ${video ? 'is-video' : ''}`} onDoubleClick={() => !video && reset()}
      onPointerDown={event => { if (video) return; event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); }}
      onPointerMove={event => {
        if (video) return;
        const old = pointers.current.get(event.pointerId); if (!old) return;
        const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
        if (other) {
          const before = Math.hypot(old.x - other.x, old.y - other.y);
          const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
          if (before > 0) setZoom(value => clamp(value * after / before));
        } else if (zoom > 1) setPan(value => ({ x: Math.max(-event.currentTarget.clientWidth * (zoom - 1) / 2, Math.min(event.currentTarget.clientWidth * (zoom - 1) / 2, value.x + event.clientX - old.x)), y: Math.max(-event.currentTarget.clientHeight * (zoom - 1) / 2, Math.min(event.currentTarget.clientHeight * (zoom - 1) / 2, value.y + event.clientY - old.y)) }));
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }} onPointerUp={event => pointers.current.delete(event.pointerId)} onPointerCancel={event => pointers.current.delete(event.pointerId)} onLostPointerCapture={event => pointers.current.delete(event.pointerId)}>
      {video || <><img className="gallery-viewer-image" src={loaded ? source : preview} alt={name} draggable={false} style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }} />{!loaded && !failed && <img className="gallery-original-loader" src={source} alt="" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}{!loaded && <span className="gallery-load-status" role="status">{failed ? 'Original unavailable — showing preview' : 'Loading full resolution…'}</span>}</>}
    </div>
    <footer><button onClick={onPrevious} aria-label="Previous media"><ChevronLeft /></button>{!video && <><button onClick={() => setZoom(value => clamp(value - .25))} aria-label="Zoom out" disabled={zoom === 1}><ZoomOut /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => clamp(value + .25))} aria-label="Zoom in" disabled={zoom === 5}><ZoomIn /></button><button onClick={reset} title="Fit image"><RotateCcw /><span>Fit</span></button></>}<button onClick={onDetails}>Details</button><button onClick={onNext} aria-label="Next media"><ChevronRight /></button></footer>
  </DialogContent></Dialog>;
}
