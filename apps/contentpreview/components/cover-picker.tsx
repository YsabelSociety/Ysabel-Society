import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Item = { id: string; name: string; archived: boolean };
export default function CoverPicker({ items, slideIds, onClose, onUpload, onChoose, renderMedia }: {
  items: Item[]; slideIds: string[]; onClose: () => void; onUpload: () => void;
  onChoose: (id: string) => Promise<void>; renderMedia: (id: string) => ReactNode;
}) {
  const [tab, setTab] = useState(slideIds.length ? 'slides' : 'library');
  const [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const available = useMemo(() => {
    const saved = items.filter(item => !item.id.startsWith('local-') && !item.archived);
    const pool = tab === 'slides' ? slideIds.map(id => saved.find(item => item.id === id)).filter(Boolean) as Item[] : saved;
    return pool.filter(item => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }, [items, slideIds, tab, query]);
  const pages = Math.max(1, Math.ceil(available.length / 24));
  const currentPage = Math.min(page, pages - 1);
  const choose = async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try { await onChoose(selected); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load this cover. Please retry.'); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="carousel-library-dialog cover-picker" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Change the cover</DialogTitle><DialogDescription>Keep your slides, caption and post details. Choosing a slide swaps it with the current cover. A new image replaces only the cover; the original stays in Media Library.</DialogDescription></DialogHeader>
      <div className="cover-picker-tools">
        <div className="sequence-view-toggle" aria-label="Cover image source">{[['slides','This post'],['library','Media Library']].map(([value,label]) => <button key={value} type="button" aria-pressed={tab === value} disabled={busy || (value === 'slides' && !slideIds.length)} onClick={() => { setTab(value); setPage(0); setSelected(null); }}>{label}</button>)}</div>
        <Button variant="outline" disabled={busy} onClick={() => { onUpload(); onClose(); }}><Upload />Upload new cover</Button>
      </div>
      <Input aria-label="Find a cover image" placeholder="Find an image…" value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setPage(0); setSelected(null); }} />
      <div className="carousel-library-grid">{available.slice(currentPage * 24, currentPage * 24 + 24).map(item => <button key={item.id} type="button" className={selected === item.id ? 'selected' : ''} aria-label={`Choose cover: ${item.name}`} aria-pressed={selected === item.id} disabled={busy} onClick={() => setSelected(item.id)}>
        <span className="carousel-library-thumb">{renderMedia(item.id)}{selected === item.id && <i><Check /></i>}</span><span><strong>{item.name}</strong></span>
      </button>)}{!available.length && <p className="carousel-library-empty">No matching uploaded media. Upload a new cover instead.</p>}</div>
      {pages > 1 && <div className="cover-picker-pages"><button aria-label="Previous cover images" disabled={busy || currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></button><span>{currentPage + 1} / {pages}</span><button aria-label="Next cover images" disabled={busy || currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight /></button></div>}
      {error && <p role="alert" className="media-delete-error">{error}</p>}
      <p className="cover-publish-hint">This edits your preview draft. Publish the feed when ready to update the client view. It does not change a post on Instagram.</p>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={!selected || busy} onClick={() => void choose()}>{busy ? 'Preparing cover…' : 'Use as cover'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
