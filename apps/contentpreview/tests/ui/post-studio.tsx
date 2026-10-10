// Local-only test page: no login, network writes or real workspace data.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Inspector } from '../../components/ysabel-workspace';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/cormorant-garamond/400.css';
import '../../styles.css';

const names = ['The opening table', 'A seasonal plate', 'Behind the bar', 'The room at dusk', 'The second course', 'A final cocktail', 'An evening together', 'The chef’s selection'];
const seed = names.map((name, index) => ({
  id: `fixture-${index}`, name, fileName: `${name}.jpg`, mimeType: 'image/jpeg', fileSize: 3_000_000,
  url: `/contentpreview-app/seed-${['interior', 'food', 'cocktail'][index % 3]}.png`,
  format: index ? 'Photo' : 'Carousel', category: 'Asian', status: 'Concept', plannedDate: null as string | null,
  caption: '', notes: '', slides: index ? [] : names.slice(1, 7).map((_, i) => `fixture-${i + 1}`),
  cropZoom: 100, cropX: 50, cropY: 50, palette: '', archived: false,
}));
function TestPage() {
  const [assets, setAssets] = useState(seed);
  const [open, setOpen] = useState(true);
  const [changes, setChanges] = useState(0);
  return <><main style={{padding: 24}}><h1>Local post studio check</h1><p>Only in-memory sample media. Nothing is saved to the server.</p><button onClick={() => setOpen(true)}>Open post studio</button><output aria-label="Saved fixture order">{assets[0].slides.join(',')}</output><output aria-label="Save count">{changes}</output></main>
    <Inspector asset={open ? assets[0] : null} assets={assets} onChange={asset => { setAssets(current => current.map(item => item.id === asset.id ? asset : item)); setChanges(count => count + 1); }} onClose={() => setOpen(false)} onRemove={() => setOpen(false)} onDuplicate={() => {}} onReplace={() => {}} onAddSlides={() => {}} />
  </>;
}
createRoot(document.getElementById('root')!).render(<TestPage />);
