// Local-only interaction fixture. No login, persistence or production media.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FeedGrid, WorkspaceNavigation } from '../../components/ysabel-workspace';
import { bindFeedPointerDrag, type FeedPointerDrag } from '../../lib/feed-pointer-drag';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '../../styles.css';

const seed = ['interior', 'food', 'cocktail', 'food'].map((name, index) => ({
  id: `grid-fixture-${index}`, name: `${name} ${index}`, fileName: `${name}.png`, mimeType: 'image/png', fileSize: 500000,
  url: `/contentpreview-app/seed-${name}.png`, format: index ? 'Photo' : 'Carousel', category: 'Asian', status: 'Concept', plannedDate: null as string | null,
  caption: '', notes: '', slides: index ? [] : ['grid-fixture-1', 'grid-fixture-2'], cropZoom: 100, cropX: 50, cropY: 50, palette: '', archived: false,
}));
function TestPage() {
  const [assets, setAssets] = useState(seed);
  const [edit, setEdit] = useState(true);
  const [opens, setOpens] = useState(0);
  const [drags, setDrags] = useState(0);
  const [positions, setPositions] = useState<(string | null)[]>(['grid-fixture-0', 'grid-fixture-3', ...Array(10).fill(null)]);
  const [mode, setMode] = useState<'swap' | 'insert'>('swap');
  const pointerDrag = useRef<FeedPointerDrag | null>(null);
  const suppressDragClickUntil = useRef(0);
  useEffect(() => {
    const clearDropHighlight = () => document.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
    return bindFeedPointerDrag({ pointerDrag, suppressDragClickUntil, edit,
      clearDropHighlight, highlightDrop: node => { clearDropHighlight(); node?.closest('.feed-tile-wrap')?.classList.add('is-drop-target'); },
      applyDrop: (source, target) => {
        if (source.type !== 'grid' || source.index === undefined) return;
        const next = [...positions];
        if (mode === 'swap') [next[source.index], next[target]] = [next[target], next[source.index]];
        else { const [post] = next.splice(source.index, 1); next.splice(target, 0, post); }
        setPositions(next);
      },
    });
  }, [positions, edit, mode]);
  const [section, setSection] = useState<Parameters<typeof WorkspaceNavigation>[0]['section']>('feed');
  return <main className="app-shell"><WorkspaceNavigation section={section} onNavigate={setSection}/>
    <section style={{ minWidth: 0, padding: 20 }}>
      <h1>Grid interaction check</h1><p>In-memory sample media only.</p>
      <button onClick={() => setEdit(value => !value)}>{edit ? 'Switch to preview' : 'Switch to edit'}</button>
      <button onClick={() => setMode(value => value === 'swap' ? 'insert' : 'swap')}>Rearrange: {mode}</button>
      <div style={{ maxWidth: 720, marginTop: 20 }}>
        <FeedGrid positions={positions} assets={assets} edit={edit} exchangeFirst={null} scale="desktop"
          onTile={() => setOpens(value => value + 1)} onDragStart={() => setDrags(value => value + 1)} onDragEnd={() => {}} onPointerStart={(source, pointer) => {
            pointerDrag.current = { source, pointerId: pointer.pointerId, startX: pointer.x, startY: pointer.y, active: false };
            setDrags(value => value + 1);
          }} onDrop={() => {}} onDelete={() => {}}
          onCrop={asset => setAssets(current => current.map(item => item.id === asset.id ? asset : item))}/>
      </div>
      <output aria-label="Interaction results">Opened: {opens}; post drag starts: {drags}; selected category: {section}</output>
      <pre aria-label="Grid post order">{JSON.stringify(positions)}</pre>
      <pre aria-label="Carousel slide order">{JSON.stringify(assets[0].slides)}</pre>
      <pre aria-label="Saved crop positions">{JSON.stringify(assets.map(({id,cropX,cropY,cropZoom}) => ({id,cropX,cropY,cropZoom})), null, 2)}</pre>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<TestPage/>);
