import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, ImagePlus, Mail, Monitor, Plus, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createNewsletter, emailTemplates, newsletterText, renderNewsletter, safeEmailUrl, venues, type EmailTemplate, type Newsletter, type Venue } from '@/lib/newsletters';
import './email-marketing.css';
type Media = {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    archived: boolean;
    category: string;
};
type Props = {
    assets: Media[];
    request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};
const endpoint = '/contentpreview/api/newsletters';
const fields: [
    keyof Newsletter,
    string,
    boolean?
][] = [['name', 'Draft name'], ['subject', 'Email subject'], ['preheader', 'Inbox preview text'], ['eyebrow', 'Small introduction'], ['heading', 'Main heading', true], ['body', 'Opening paragraph', true], ['secondaryHeading', 'Second heading'], ['secondaryBody', 'Second paragraph', true], ['detail', 'Occasion / date / time'], ['cta', 'Button text'], ['link', 'Reservation link (https://)'], ['address', 'Business postal address'], ['unsubscribe', 'Unsubscribe link or *|UNSUB|*']];
function TemplateCard({ template, choose }: { template: EmailTemplate; choose: () => void }) {
    const example = useMemo(() => createNewsletter(template), [template]);
    return <article><button className="email-template-live" onClick={choose} aria-label={`Create ${template.name} newsletter`}>
      <div className="email-thumbnail"><iframe title={`${template.name} design`} tabIndex={-1} aria-hidden="true" sandbox="" loading="lazy" srcDoc={renderNewsletter(example, example.images, true)} /></div>
      <span className="email-template-choose">Use this design <Plus size={16}/></span>
    </button><h3>{template.name}</h3><p>{template.description}</p><small className="email-template-count">{example.images.length} images · Editable demo content</small></article>;
}
export default function EmailMarketing({ assets, request }: Props) {
    const [venue, setVenue] = useState<Venue>('Ysabel Asian');
    const [drafts, setDrafts] = useState<Newsletter[]>([]), [draft, setDraft] = useState<Newsletter | null>(null);
    const [status, setStatus] = useState('Loading drafts…'), [error, setError] = useState('');
    const [mobile, setMobile] = useState(false), [picker, setPicker] = useState<number | null>(null), [search, setSearch] = useState('');
    const [exportOpen, setExportOpen] = useState(false), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [html, setHtml] = useState('');
    const [exportKind, setExportKind] = useState<'test'|'campaign'>('test');
    const req = useRef(request);
    req.current = request;
    const etags = useRef(new Map<string, string>()), current = useRef<Newsletter | null>(null), pending = useRef<ReturnType<typeof setTimeout> | null>(null);
    const queue = useRef(Promise.resolve()), revision = useRef(0), mounted = useRef(true);
    const dirty = useRef(false);
    useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if(dirty.current) { event.preventDefault(); event.returnValue=''; } }; window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn); }, []);
    async function read(response: Response) { const data = await response.json().catch(() => ({})); if (!response.ok)
        throw new Error(response.status === 401 ? 'Your session expired. Sign in again; keep this draft open until it is saved.' : data.error || 'Could not connect. Please retry.'); return data; }
    function save(value: Newsletter) {
        setStatus('Saving…');
        const serial = revision.current;
        const result = queue.current.then(async () => {
            const data = await read(await req.current(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draft: value, etag: etags.current.get(value.id) }) }));
            etags.current.set(value.id, data.etag);
            if (mounted.current) {
                setDrafts(old => [data.draft, ...old.filter(d => d.id !== value.id)]);
                if (serial === revision.current && current.current?.id === value.id) {
                    setStatus('Saved'); dirty.current = false;
                }
                setError('');
            }
        });
        queue.current = result.catch(e => { if (mounted.current) {
            setStatus('Not saved');
            setError(e.message);
        } });
        return result;
    }
    async function load() {
        try {
            const data = await read(await req.current(endpoint, { cache: 'no-store' }));
            data.drafts.forEach((d: {
                draft: Newsletter;
                etag: string;
            }) => etags.current.set(d.draft.id, d.etag));
            setDrafts(data.drafts.map((d: {
                draft: Newsletter;
            }) => d.draft));
            setStatus('Saved');
            setError('');
        }
        catch (e) {
            setError((e as Error).message);
            setStatus('Connection unavailable');
        }
    }
    useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
        if (current.current)
            void save(current.current).catch(() => { });
    } }; }, []);
    function change(patch: Partial<Newsletter>) { if (!current.current)
        return; const value = { ...current.current, ...patch }; dirty.current = true; current.current = value; setDraft(value); setHtml(''); revision.current++; if (pending.current)
        clearTimeout(pending.current); setStatus('Unsaved changes'); pending.current = setTimeout(() => { pending.current = null; void save(value).catch(() => { }); }, 900); }
    async function open(value: Newsletter | null, duplicate = false) { try {
        if ((pending.current || dirty.current) && current.current && !duplicate) {
            if(pending.current) clearTimeout(pending.current);
            pending.current = null;
            await save(current.current);
        }
        await queue.current;
        current.current = value;
        revision.current++;
        dirty.current = value ? !etags.current.has(value.id) : false;
        setDraft(value);
        setHtml('');
        setError('');
    }
    catch { /* Keep the unsaved draft visible. */ } }
    function source(ref: string) { return assets.find(a => a.id === ref)?.url || (ref.startsWith('https://ysabelsociety.com/assets/') ? ref : ''); }
    function previewSource(ref: string) { const url = source(ref); if (!url)
        return ''; if (url.includes('/api/media/')) {
        const parsed = new URL(url, location.origin);
        parsed.searchParams.set('variant', 'display');
        return parsed.href;
    } return url; }
    async function newDraft(templateId: string) { const template = emailTemplates.find(t => t.id === templateId)!; const value = createNewsletter(template); await open(value); if (current.current?.id === value.id)
        void save(value).catch(() => { }); }
    async function remove(value: Newsletter) { if (!window.confirm(`Delete “${value.name}”? Exported emails and gallery photos are not affected.`))
        return; try {
        await queue.current;
        await read(await req.current(endpoint, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: value.id }) }));
        setDrafts(old => old.filter(d => d.id !== value.id));
    }
    catch (e) {
        setError((e as Error).message);
    } }
    function movePhoto(index: number, delta: number) {
      if(!draft) return; const target=index+delta; if(target<0||target>=draft.images.length)return;
      const images=[...draft.images],alts=[...draft.alts]; [images[index],images[target]]=[images[target],images[index]]; [alts[index],alts[target]]=[alts[target],alts[index]]; change({images,alts});
    }
    async function exportEmail() {
        if (!draft)
            return;
        if (exportKind === 'campaign' && (!draft.address.trim() || !draft.subject.trim() || !draft.cta.trim() || !draft.link.startsWith('https://') || !safeEmailUrl(draft.link) || !(draft.unsubscribe === '*|UNSUB|*' || draft.unsubscribe.startsWith('https://') && safeEmailUrl(draft.unsubscribe)))) {
            setError('Add an email subject, business postal address, reservation button/link and a valid unsubscribe link before export.');
            return;
        }
        if (draft.images.some(ref => !ref.startsWith('https://ysabelsociety.com/assets/')) && !consent) {
            setError('Please confirm that the selected image copies can be made public for email recipients.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            if (pending.current) {
                clearTimeout(pending.current);
                pending.current = null;
            }
            if(exportKind === 'campaign') await save(draft); else void save(draft).catch(()=>{});
            const urls: string[] = [];
            for (const ref of draft.images) {
                if(ref.startsWith('https://ysabelsociety.com/assets/')) { urls.push(ref); continue; }
                const url = previewSource(ref);
                if (!url)
                    throw new Error('One photograph is no longer available. Replace it from your Media Library.');
                const response = await fetch(url, { credentials: 'same-origin' });
                if (!response.ok)
                    throw new Error('A photograph could not be loaded. Check that its gallery upload has completed.');
                const bitmap = await createImageBitmap(await response.blob());
                try {
                    const scale = Math.min(1, 1200 / bitmap.width, 1600 / bitmap.height);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(bitmap.width * scale);
                    canvas.height = Math.round(bitmap.height * scale);
                    const context = canvas.getContext('2d');
                    if (!context)
                        throw new Error('Image preparation is unavailable in this browser.');
                    context.fillStyle = '#fff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                    const jpeg = canvas.toDataURL('image/jpeg', .88).split(',')[1];
                    const result = await read(await req.current(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'export-image', confirmPublic: true, jpeg }) }));
                    urls.push(result.url);
                }
                finally {
                    bitmap.close();
                }
            }
            setHtml(renderNewsletter(draft, urls, false, exportKind === 'test'));
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function download(content: string, extension: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = `${draft?.name.replace(/[^a-z0-9 -]/gi, '') || 'ysabel-newsletter'}.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    const filtered = assets.filter(a => !a.archived && a.mimeType.startsWith('image/') && a.name.toLowerCase().includes(search.toLowerCase()));
    return <section className="email-studio">
    <header className="email-heading"><div><span className="page-kicker">THE ART OF AN INVITATION</span><h1>Email Marketing</h1><p>Ysabel Asian · Ten long-form newsletter directions.</p></div><span className="email-save" role="status">{status === 'Saved' && <Check size={13}/>} {status}</span></header>
    {error && <div className="email-error" role="alert">{error} <button onClick={() => draft ? void save(draft).catch(() => { }) : void load()}>Retry save / connection</button></div>}
    {!draft ? <><nav className="email-venues" aria-label="Restaurant collection">{venues.map(v => <button key={v} className={venue === v ? 'active' : ''} onClick={() => setVenue(v)}>{v}</button>)}</nav><div className="email-collection-intro"><h2>{venue === 'Ysabel Asian' ? 'The ritual of discovery' : venue === 'Ysabel Italian' ? 'An invitation to the table' : 'Evenings in the Garden'}</h2><p>Distinct structures, 3–6 photographs, and editable demo copy. Choose a design to see the complete newsletter.</p></div><div className="email-templates">{emailTemplates.filter(t=>t.venue===venue).map(t=><TemplateCard key={t.id} template={t} choose={()=>void newDraft(t.id)}/>)}</div><div className="email-drafts"><h2>Saved invitations <small>{drafts.filter(d => d.venue === venue).length}</small></h2>{drafts.filter(d => d.venue === venue).map(d => <div key={d.id}><button onClick={() => void open(d)}><Mail size={18}/><span><strong>{d.name}</strong><small>{d.subject}</small></span></button><button aria-label={`Delete ${d.name}`} onClick={() => void remove(d)}><Trash2 size={17}/></button></div>)}{!drafts.some(d => d.venue === venue) && <p>Your saved drafts will appear here.</p>}</div></> : <>
    <div className="email-toolbar"><Button variant="ghost" onClick={() => void open(null)}><ArrowLeft />Collection</Button><span>{draft.venue}</span><div><Button variant={mobile ? 'ghost' : 'outline'} onClick={() => setMobile(false)} aria-label="Desktop email preview"><Monitor /></Button><Button variant={mobile ? 'outline' : 'ghost'} onClick={() => setMobile(true)} aria-label="Mobile email preview"><Smartphone /></Button><Button variant="outline" onClick={() => void open({ ...draft, id: crypto.randomUUID(), name: draft.name + ' — Copy' }, true).then(() => current.current && save(current.current)).catch(() => { })}><Copy />Duplicate</Button><Button onClick={() => { setExportOpen(true); setConsent(false); setError(''); }}><Download />Export email</Button></div></div>
    <div className="email-editor"><aside className="email-controls"><h2>Make it yours</h2><p>All changes save automatically. Photography stays independent from your feed.</p><div className="email-photo-controls">{draft.images.map((ref,i)=><div key={i} className="email-photo-slot"><button onClick={()=>{setPicker(i);setSearch('');}}><img src={previewSource(ref)} alt={draft.alts[i]} loading="lazy"/><span><ImagePlus size={15}/> Replace {i+1}</span></button><div className="email-photo-order"><button disabled={i===0} onClick={()=>movePhoto(i,-1)} aria-label={`Move photo ${i+1} earlier`}>←</button><button disabled={i===draft.images.length-1} onClick={()=>movePhoto(i,1)} aria-label={`Move photo ${i+1} later`}>→</button><button disabled={draft.images.length<=3} onClick={()=>change({images:draft.images.filter((_,j)=>j!==i),alts:draft.alts.filter((_,j)=>j!==i)})} aria-label={`Remove photo ${i+1}`}><Trash2 size={13}/></button></div></div>)}</div><Button variant="outline" disabled={draft.images.length>=6} onClick={()=>{setPicker(draft.images.length);setSearch('');}}><Plus/>Add photograph · {draft.images.length}/6</Button>{draft.alts.map((alt, i) => <label key={'alt' + i}>Photo {i + 1} description<input value={alt} onChange={e => change({ alts: draft.alts.map((a, n) => n === i ? e.target.value : a) })}/></label>)}<label>Typography<select value={draft.font} onChange={e => change({ font: e.target.value as Newsletter['font'] })}><option value="editorial">Editorial — Georgia</option><option value="classic">Classic — Times</option><option value="modern">Modern — Sans serif</option></select></label>{fields.map(([key, label, multi]) => <label key={key}>{label}{multi ? <textarea rows={key === 'body' || key === 'secondaryBody' ? 5 : 2} value={String(draft[key] || '')} onChange={e => change({ [key]: e.target.value })}/> : <input value={String(draft[key] || '')} onChange={e => change({ [key]: e.target.value })}/>}</label>)}{(draft.sections||[]).map((s,i)=><fieldset className="email-story-section" key={i}><legend>Chapter {i+1}</legend><label>Chapter heading<input value={s.title} onChange={e=>change({sections:draft.sections!.map((v,j)=>j===i?{...v,title:e.target.value}:v)})}/></label><label>Chapter text<textarea rows={5} value={s.body} onChange={e=>change({sections:draft.sections!.map((v,j)=>j===i?{...v,body:e.target.value}:v)})}/></label></fieldset>)}<p className="email-help">The unsubscribe placeholder works with Mailchimp. Replace it with your sending platform’s unsubscribe link or merge tag before sending. Use your real business postal address.</p><Button variant="outline" onClick={() => void save(draft).catch(() => { })}>Save now</Button></aside><div className="email-canvas"><div className="email-envelope"><span>{draft.subject}</span><small>{draft.preheader}</small></div><iframe title="Newsletter design preview" sandbox="" style={{ maxWidth: mobile ? 375 : 640 }} srcDoc={renderNewsletter(draft, draft.images.map(previewSource), true)}/><p>Email clients may render fonts and spacing differently. Send a test through your email platform before a campaign.</p></div></div></>}
    <Dialog open={picker !== null} onOpenChange={open => !open && setPicker(null)}><DialogContent className="email-picker"><DialogHeader><DialogTitle>Choose from Media Library</DialogTitle><DialogDescription>Use an uploaded photograph without moving it into the feed. Videos cannot be embedded reliably in email.</DialogDescription></DialogHeader><input aria-label="Search media" placeholder="Search photography…" value={search} onChange={e => setSearch(e.target.value)}/><div className="email-picker-grid">{filtered.map(a => <button key={a.id} onClick={() => { if (draft && picker !== null)
        change({ images: picker === draft.images.length ? [...draft.images,a.id] : draft.images.map((id, i) => i === picker ? a.id : id), alts: picker === draft.images.length ? [...draft.alts,a.name] : draft.alts.map((alt, i) => i === picker ? a.name : alt) }); setPicker(null); }}><img src={previewSource(a.id).replace('variant=display','variant=thumbnail')} loading="lazy" alt={a.name}/><span>{a.name}</span></button>)}{!filtered.length && <p>No photographs found. Upload images in Media Library first.</p>}</div></DialogContent></Dialog>
    <Dialog open={exportOpen} onOpenChange={open => !busy && setExportOpen(open)}><DialogContent className="email-export"><DialogHeader><DialogTitle>Your invitation, ready for email</DialogTitle><DialogDescription>Export editable HTML and a plain-text companion. No emails are sent from this workspace.</DialogDescription></DialogHeader>{error && <p role="alert" className="email-error">{error}</p>}{!html ? <><div className="email-export-modes"><Button variant={exportKind==='test'?'default':'outline'} onClick={()=>setExportKind('test')}>Test HTML · Demo content</Button><Button variant={exportKind==='campaign'?'default':'outline'} onClick={()=>setExportKind('campaign')}>Campaign HTML</Button></div><p>{exportKind==='test'?'Export immediately with demo text. No recipient, email address, or sender details needed. The file is marked as a design test.':'Add your real postal address, reservation link and unsubscribe link before generating a campaign file.'}</p>{draft?.images.some(ref=>!ref.startsWith('https://ysabelsociety.com/assets/'))&&<><p>Your selected gallery photographs need public copies for recipients to see them. Originals and the rest of the gallery stay private.</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I approve public email copies of these photographs.</label></>}<Button disabled={busy || (!!draft?.images.some(ref=>!ref.startsWith('https://ysabelsociety.com/assets/'))&&!consent)} onClick={()=>void exportEmail()}>{busy?'Preparing your newsletter…':exportKind==='test'?'Generate test HTML':'Generate campaign HTML'}</Button></> : <><p><Check size={16}/> Export ready. Open the HTML file to review the full design, or import it into your email platform. Replace demo offers, dates and sender details before a real campaign.</p><div className="email-export-buttons"><Button onClick={() => download(html, 'html', 'text/html')}><Download />Download HTML</Button><Button variant="outline" onClick={() => void navigator.clipboard.writeText(html).then(() => setStatus('Email code copied')).catch(() => setError('Clipboard unavailable. Download the HTML instead.'))}><Copy />Copy code</Button><Button variant="outline" onClick={() => draft && download(newsletterText(draft), 'txt', 'text/plain')}>Plain text</Button></div><textarea aria-label="Exported email HTML" readOnly value={html}/></>}</DialogContent></Dialog>
  </section>;
}
