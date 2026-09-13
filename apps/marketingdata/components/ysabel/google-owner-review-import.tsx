'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { prepareGoogleOwnerReviews } from '@/lib/google-owner-review-import';
import type { CommunityRecord } from '@/lib/community';

export function GoogleOwnerReviewImport({ records, onSaved }: { records: CommunityRecord[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false), [raw, setRaw] = useState(''), [error, setError] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof prepareGoogleOwnerReviews> | null>(null);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  async function run() {
    setError('');
    if (!preview) { try { setPreview(prepareGoogleOwnerReviews(raw, records)); } catch(e) { setError((e as Error).message); } return; }
    setBusy(true);
    try {
      for (let i = 0; i < preview.batches.length; i++) {
        setStatus(`Importing batch ${i + 1} of ${preview.batches.length}…`);
        const response = await fetch('/marketingdata/api/community', { method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({op:'import',source:'gbp',kind:'review',csv:preview.batches[i]}), signal: AbortSignal.timeout(60000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Review import failed.');
      }
      const photos=JSON.parse(raw).reviews.filter((r:{photos?:unknown[]})=>r.photos?.length).map((r:{profileId:string;photos:unknown[]})=>({profileId:r.profileId,photos:r.photos}));
      if(photos.length){
        setStatus('Saving customer review photos…');
        const response=await fetch('/marketingdata/api/review-enrichment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviews:photos}),signal:AbortSignal.timeout(60000)});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Photos could not be saved. Reviews were imported; retry the snapshot to save photos.');
      }
      setStatus(`${preview.added} new reviews imported · ${preview.updated} existing reviews updated.`);
      setRaw(''); setPreview(null); onSaved();
      window.dispatchEvent(new Event('ysabel:community-updated'));
    } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <button className="secondary" onClick={() => setOpen(true)}><Download size={16}/> Import Google snapshot</button>
    <Dialog open={open} onOpenChange={v => {if(!busy)setOpen(v);}}>
      <DialogContent style={{maxWidth:680}}>
        <DialogHeader><DialogTitle>Google owner-view review import</DialogTitle>
          <DialogDescription>Import reviews captured from Ysabel Society’s Google Business owner view. Existing reviews are matched by reviewer profile; saved dates and replies are retained. This works independently of Google API approval.</DialogDescription></DialogHeader>
        <label htmlFor="google-review-snapshot">Review snapshot</label>
        <textarea id="google-review-snapshot" value={raw} disabled={busy} onChange={e=>{setRaw(e.target.value);setPreview(null);setStatus('');}}
          rows={7} style={{width:'100%',resize:'vertical'}} placeholder="Paste the captured Google review JSON"/>
        {preview && <p>{preview.captured} captured · {preview.added} new · {preview.updated} updates · {preview.unchanged} unchanged · {preview.retained} previously saved reviews retained{preview.skipped ? ` · ${preview.skipped} API reviews preserved` : ''}</p>}
        {error && <p role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
        <button className="primary" disabled={busy || !raw.trim()} onClick={()=>void run()}>{busy?'Importing…':preview?'Import reviews':'Preview review import'}</button>
        <p className="muted">Google’s relative dates remain marked approximate. Automatic API sync is shown separately in connection settings.</p>
      </DialogContent>
    </Dialog>
  </>;
}
