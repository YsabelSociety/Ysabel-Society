// Isolated fixture: a silent PCM track exercises real media controls without
// playing noise, uploading content, or accessing the user's saved workspace.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FeedGrid } from '../../components/ysabel-workspace';
import { usePreviewView } from '../../lib/use-preview-view';
import '../../styles.css';

function silentTrack() {
  const bytes = new Uint8Array(16044);
  const data = new DataView(bytes.buffer);
  const label = (at: number, text: string) => [...text].forEach((letter, index) => data.setUint8(at + index, letter.charCodeAt(0)));
  label(0, 'RIFF'); data.setUint32(4, 16036, true); label(8, 'WAVE'); label(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, 8000, true); data.setUint32(28, 16000, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  label(36, 'data'); data.setUint32(40, 16000, true);
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes));
}

function TestPage() {
  const { view, setView, mobile } = usePreviewView();
  const [assets] = useState(() => [0, 1, 2].map(index => ({
    id: `sound-fixture-${index}`, name: index ? `Silent playback check ${index}` : 'Carousel cover', fileName: index ? 'test.wav' : 'cover.png', mimeType: index ? 'video/mp4' : 'image/png', fileSize: 16044,
    url: index ? silentTrack() : '/contentpreview-app/seed-interior.png', format: index ? 'Video' : 'Carousel', category: 'Other', status: 'Concept', plannedDate: null,
    caption: '', notes: '', slides: index ? [] : ['sound-fixture-1'], cropZoom: 100, cropX: 50, cropY: 50, palette: '', archived: false,
  })));
  return <main style={{ padding: 16 }}><h1>Device and sound check</h1>
    <output aria-label="Device default">{view} · {mobile ? 'mobile device' : 'desktop device'}</output>
    <div><button onClick={() => setView('desktop')}>Request desktop</button> · <button onClick={() => setView('grid')}>Request grid</button></div>
    <div style={{ maxWidth: 700, marginTop: 20 }}><FeedGrid positions={['sound-fixture-0', 'sound-fixture-2']} assets={assets} edit={false} scale={view === 'mobile' ? 'phone' : 'desktop'} exchangeFirst={null} onTile={() => {}} onDragStart={() => {}} onDragEnd={() => {}} onPointerStart={() => {}} onDrop={() => {}} onDelete={() => {}} onCrop={() => {}} /></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<TestPage/>);
