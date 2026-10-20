// Isolated stress fixture: generated names + bundled demo pictures, no API or saved data.
import { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VirtualMediaGrid from '../../components/virtual-media-grid';
import GalleryViewer from '../../components/gallery-viewer';
import { ProgressiveImage, useMediaVisibility } from '../../components/media-preview';
import '../../styles.css';

const items = Array.from({ length: 3000 }, (_, index) => ({ id: `sample-${index}`, name: `Sample ${index + 1}` }));
const noRecovery = () => Promise.resolve(null);
function Thumb() {
  const { ref, visible } = useMediaVisibility(true);
  return <span ref={ref} className="library-thumb">{visible && <ProgressiveImage thumbnail="/contentpreview-app/seed-food.png" alt="Demo food" style={{}} recover={noRecovery} />}</span>;
}
function Fixture() {
  const [visible, setVisible] = useState(true), [virtual, setVirtual] = useState(true), [dock, setDock] = useState(false);
  const [selection, setSelection] = useState<string | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(0);
  const start = useRef(performance.now());
  useLayoutEffect(() => { setDuration(Math.round((performance.now() - start.current) * 10) / 10); }, [visible, virtual, dock]);
  const renderItem = (item: typeof items[number]) => <article className={selected.includes(item.id) ? 'selected' : ''} key={item.id}>
    <button className={dock ? 'library-dock-asset' : 'library-asset-button'} draggable onClick={() => setSelection(item.id)}><Thumb />{!dock && <><strong>{item.name}</strong><small>Photo · Asian</small></>}</button>
    <button className="library-delete-one" aria-label={`Select ${item.name}`} onClick={() => setSelected(value => value.includes(item.id) ? value.filter(id => id !== item.id) : [...value, item.id])}>✓</button>
  </article>;
  return <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
    <header style={{ padding: 16, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <button onClick={() => { start.current = performance.now(); setVisible(value => !value); }}>{visible ? 'Leave media' : 'Open media'}</button>
      <button onClick={() => { start.current = performance.now(); setVirtual(value => !value); }}>{virtual ? 'Unvirtualized baseline' : 'Optimized gallery'}</button>
      <button onClick={() => { start.current = performance.now(); setDock(value => !value); }}>{dock ? 'Full library' : 'Dock library'}</button>
      <span role="status">{virtual ? 'Optimized' : 'Baseline'} · 3000 assets · render {duration} ms · {selected.length} selected</span>
    </header>
    {visible && (dock ? <aside className="library-dock" style={{ position: 'relative', left: 16, top: 0, width: 600, height: 600, gridTemplateRows: '1fr', resize: 'both' }}><VirtualMediaGrid items={items} dock renderItem={renderItem} /></aside>
      : <section className="library-page" style={{ flex: 1 }}><h1>Large library check</h1><p>All 3,000 samples must remain reachable.</p>{virtual ? <VirtualMediaGrid items={items} renderItem={renderItem} /> : <div className="library-grid">{items.map(renderItem)}</div>}</section>)}
    {selection && <GalleryViewer key={selection} name={selection} source="/contentpreview-app/seed-food.png?original=1" thumbnail="/contentpreview-app/seed-food.png" preview="/contentpreview-app/seed-food.png?display=1" onClose={() => setSelection(null)} onPrevious={() => setSelection('sample-previous')} onNext={() => setSelection('sample-next')} onDetails={() => setSelection(null)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
