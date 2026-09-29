import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, List, Palette, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calendarDays, CHANNELS, colorInk, FORMATS, localDate, shiftMonth, STATUSES, validatePlan, validMonth, VENUES, VENUE_COLORS, type Plan, type Venue } from '@/lib/ereza-planning';
import './ereza-planning.css';

const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
const order = (plans: Plan[]) => [...plans].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
function Choice({ label, value, values, onChange }: { label: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <div className="ereza-field"><span>{label}</span><Select value={value} onValueChange={value => value && onChange(value)}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{values.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>;
}

export default function ErezaPlanning({ token, initialMonth }: { token: string; initialMonth: string }) {
  const today = localDate();
  const [month, setMonth] = useState(validMonth(initialMonth) ? initialMonth : today.slice(0, 7));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [colors, setColors] = useState<Record<Venue, string>>({ ...VENUE_COLORS });
  const [venue, setVenue] = useState<Venue | 'All venues'>('All venues');
  const [view, setView] = useState<'calendar' | 'venues'>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 650px)').matches ? 'venues' : 'calendar');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<Plan | null>(null);
  const [original, setOriginal] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [colorVenue, setColorVenue] = useState<Venue | null>(null);
  const [newColor, setNewColor] = useState('');
  const [colorError, setColorError] = useState('');
  const [colorBusy, setColorBusy] = useState(false);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch('/contentpreview/api/ereza' + path, { ...options, cache: 'no-store', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(response.status === 401 ? 'Your session expired. Sign in again to save your plans.' : data.error || 'Unable to save. Please retry; your text is kept here.');
    }
    return response.json();
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setPlans([]);
    request('?month=' + month, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      setPlans(order(data.plans)); setColors(data.colors); setLoading(false);
    }).catch(error => { if (!controller.signal.aborted) { setLoadError(error.message); setLoading(false); } });
    return () => controller.abort();
  }, [month, reload, request]);

  const filtered = useMemo(() => plans.filter(plan => venue === 'All venues' || plan.venue === venue), [plans, venue]);
  const days = useMemo(() => calendarDays(month), [month]);
  const planColor = (plan: Plan) => plan.color || colors[plan.venue];
  const style = (plan: Plan): CSSProperties => ({ background: planColor(plan), color: colorInk(planColor(plan)) });
  const changeMonth = (next: string) => { if (validMonth(next)) { setMonth(next); setMessage(''); } };
  const add = (date = month === today.slice(0, 7) ? today : month + '-01', selectedVenue = venue === 'All venues' ? VENUES[0] : venue) => {
    const plan: Plan = { id: crypto.randomUUID(), date, time: '', venue: selectedVenue, title: '', format: 'Story', channels: ['Instagram'], status: 'Planned', notes: '', referenceUrl: '', color: null, revision: 0 };
    setDraft(plan); setOriginal(JSON.stringify(plan)); setFormError(''); setEditorOpen(true);
  };
  const open = (plan: Plan) => { setDraft({ ...plan, channels: [...plan.channels] }); setOriginal(JSON.stringify(plan)); setFormError(''); setEditorOpen(true); };
  const close = () => { if (busy) return; if (JSON.stringify(draft) !== original) setDiscardOpen(true); else setEditorOpen(false); };
  const patch = (values: Partial<Plan>) => setDraft(current => current ? { ...current, ...values } : current);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft || busy) return;
    setBusy(true); setFormError('');
    try {
      const clean = validatePlan(draft);
      const data = await request('', { method: 'POST', body: JSON.stringify({ action: 'save', plan: clean }) });
      setPlans(current => order([...current.filter(item => item.id !== data.plan.id), data.plan].filter(item => item.date.startsWith(month))));
      setMessage('Saved · ' + clean.title); setEditorOpen(false);
      if (!clean.date.startsWith(month)) changeMonth(clean.date.slice(0, 7));
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Unable to save. Please retry.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!draft || busy) return;
    setBusy(true); setFormError('');
    try {
      await request('', { method: 'DELETE', body: JSON.stringify({ id: draft.id, revision: draft.revision }) });
      setPlans(current => current.filter(item => item.id !== draft.id)); setEditorOpen(false); setDeleteOpen(false); setMessage('Plan deleted.');
    } catch (error) { setDeleteOpen(false); setFormError(error instanceof Error ? error.message : 'Unable to delete. Please retry.'); }
    finally { setBusy(false); }
  }
  async function saveColor() {
    if (!colorVenue || colorBusy) return;
    setColorBusy(true); setColorError('');
    try {
      await request('', { method: 'POST', body: JSON.stringify({ action: 'color', venue: colorVenue, color: newColor }) });
      setColors(current => ({ ...current, [colorVenue]: newColor })); setColorVenue(null); setMessage('Venue color saved.');
    } catch (error) { setColorError(error instanceof Error ? error.message : 'Unable to save color.'); }
    finally { setColorBusy(false); }
  }
  const entry = (plan: Plan) => <button key={plan.id} className={'ereza-entry ' + (plan.status === 'Posted' ? 'ereza-entry--posted' : '')} style={style(plan)} onClick={() => open(plan)}>
    <span className="ereza-entry-venue">{plan.venue.replace('Ysabel ', '')}<span>{plan.format}</span></span>
    <strong>{plan.title}</strong><span className="ereza-entry-meta"><span><Clock3 size={12} />{plan.time || 'Time TBD'}</span><span>{plan.status === 'Posted' && <Check size={12} />}{plan.status}</span></span>
    {plan.channels.length > 0 && <small>{plan.channels.join(' · ')}</small>}
  </button>;

  return <section className="ereza-page" aria-labelledby="ereza-title">
    <header className="ereza-heading"><div><span className="ereza-kicker"><CalendarDays size={16} />THE MONTH, TOGETHER</span><h1 id="ereza-title">Ereza Stories <span>& Monthly Planning</span></h1><p>Plan the story. Choose the venue. Set the moment.</p></div><Button disabled={loading || Boolean(loadError)} onClick={() => add()}><Plus />New content</Button></header>
    <div className="ereza-venue-bar" aria-label="Venue filters and colors"><button className="ereza-all" aria-pressed={venue === 'All venues'} onClick={() => setVenue('All venues')}>All venues</button>{VENUES.map(item => <div key={item} className="ereza-venue-chip" style={{ background: colors[item], color: colorInk(colors[item]) }}><button aria-pressed={venue === item} onClick={() => setVenue(item)}>{item}<span>{plans.filter(plan => plan.venue === item).length}</span></button><button disabled={loading || Boolean(loadError)} aria-label={'Choose color for ' + item} title={'Change ' + item + ' color'} onClick={() => { setColorVenue(item); setNewColor(colors[item]); setColorError(''); }}><Palette size={16} /></button></div>)}</div>
    <div className="ereza-toolbar"><div className="ereza-month-control"><Button variant="ghost" size="icon" aria-label="Previous planning month" disabled={month <= '1900-01'} onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft /></Button><label><span className="sr-only">Planning month</span><input type="month" min="1900-01" max="2200-12" value={month} onChange={event => changeMonth(event.target.value)} /></label><Button variant="ghost" size="icon" aria-label="Next planning month" disabled={month >= '2200-12'} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight /></Button><Button variant="ghost" onClick={() => changeMonth(today.slice(0, 7))}>This month</Button></div><div className="ereza-views" role="group" aria-label="Planning view"><button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><CalendarDays size={16} />Calendar</button><button aria-pressed={view === 'venues'} onClick={() => setView('venues')}><List size={16} />By venue</button></div></div>
    <div className="ereza-status" role="status">{loading ? 'Loading your plans…' : loadError ? '' : message || `${filtered.length} planned · ${filtered.filter(plan => plan.status === 'Posted').length} posted · Times in Prishtina`}</div>
    {loadError && <div className="ereza-error" role="alert">{loadError}<Button variant="outline" onClick={() => setReload(value => value + 1)}>Retry</Button></div>}
    {!loading && !loadError && <>
      {!filtered.length && <p className="ereza-empty">No content planned for {dateLabel(month + '-01', { month: 'long', year: 'numeric' })}{venue !== 'All venues' ? ` · ${venue}` : ''}. Choose a day or add your first plan.</p>}
      {view === 'calendar' ? <div className="ereza-calendar-scroll"><div className="ereza-calendar"><div className="ereza-weekdays">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <span key={day}>{day}</span>)}</div><div className="ereza-days">{days.map((day, index) => day ? <article key={day} className={'ereza-day ' + (day === today ? 'ereza-day--today' : '')}><header><time dateTime={day} aria-label={dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}>{Number(day.slice(-2))}</time><button aria-label={'Add content on ' + day} onClick={() => add(day)}><Plus size={16} /></button></header>{filtered.filter(plan => plan.date === day).map(entry)}</article> : <div key={'blank-' + index} className="ereza-day ereza-day--blank" />)}</div></div></div> : <div className="ereza-venue-columns">{VENUES.filter(item => venue === 'All venues' || item === venue).map(item => <section key={item}><header style={{ borderColor: colors[item] }}><h2>{item}</h2><button aria-label={'Add content for ' + item} onClick={() => add(undefined, item)}><Plus size={18} /></button></header>{filtered.filter(plan => plan.venue === item).map(plan => <div className="ereza-agenda-item" key={plan.id}><time dateTime={plan.date}>{dateLabel(plan.date, { weekday: 'short', day: 'numeric', month: 'short' })}</time>{entry(plan)}</div>)}{!filtered.some(plan => plan.venue === item) && <p className="ereza-venue-empty">Nothing planned yet.</p>}</section>)}</div>}
    </>}
    <p className="ereza-footnote">Planning only · Marking content as “Posted” records its status; it does not publish to social media.</p>

    <Dialog open={editorOpen} onOpenChange={open => !open && close()}><DialogContent className="ereza-editor"><DialogHeader><DialogTitle>{draft?.revision ? 'Edit content plan' : 'Plan with Ereza'}</DialogTitle><DialogDescription>Keep the venue, timing and creative direction together.</DialogDescription></DialogHeader>{draft && <form onSubmit={save}>
      <fieldset disabled={busy}>
        <label className="ereza-field">Content title<Input autoFocus required maxLength={180} value={draft.title} onChange={event => patch({ title: event.target.value })} placeholder="e.g. Chef’s tasting menu · evening stories" /></label>
        <div className="ereza-form-grid"><Choice label="Venue" value={draft.venue} values={VENUES} onChange={value => patch({ venue: value as Venue })} /><Choice label="Format" value={draft.format} values={FORMATS} onChange={value => patch({ format: value as Plan['format'] })} /><label className="ereza-field">Day<Input type="date" required min="1900-01-01" max="2200-12-31" value={draft.date} onChange={event => patch({ date: event.target.value })} /></label><label className="ereza-field">Time · Prishtina<Input type="time" value={draft.time} onChange={event => patch({ time: event.target.value })} /></label></div>
        <fieldset className="ereza-channels"><legend>Social channels</legend>{CHANNELS.map(channel => <label key={channel}><input type="checkbox" checked={draft.channels.includes(channel)} onChange={event => patch({ channels: event.target.checked ? [...draft.channels, channel] : draft.channels.filter(item => item !== channel) })} />{channel}</label>)}</fieldset>
        <div className="ereza-form-grid"><Choice label="Status" value={draft.status} values={STATUSES} onChange={value => patch({ status: value as Plan['status'] })} /><div className="ereza-field"><span>Plan color</span><div className="ereza-color-inline"><input type="color" aria-label="Plan color" value={draft.color || colors[draft.venue]} onChange={event => patch({ color: event.target.value })} /><button type="button" onClick={() => patch({ color: null })}>{draft.color ? 'Use venue color' : 'Using venue color'}</button></div></div></div>
        <label className="ereza-field">Creative notes<Textarea rows={4} maxLength={10000} value={draft.notes} onChange={event => patch({ notes: event.target.value })} placeholder="Shots to capture, story sequence, copy, or what to prepare…" /></label>
        <label className="ereza-field">Reference link <span className="ereza-optional">optional</span><Input type="url" maxLength={2000} value={draft.referenceUrl} onChange={event => patch({ referenceUrl: event.target.value })} placeholder="https://…" /></label>
      </fieldset>
      {formError && <p className="ereza-error" role="alert">{formError}</p>}
      <DialogFooter className="ereza-editor-actions">{draft.revision > 0 && <Button type="button" variant="ghost" disabled={busy} onClick={() => setDeleteOpen(true)}><Trash2 />Delete</Button>}<Button type="button" variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save plan'}</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
    <AlertDialog open={deleteOpen} onOpenChange={open => !busy && setDeleteOpen(open)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this plan?</AlertDialogTitle><AlertDialogDescription>This removes only “{draft?.title}” from Ereza’s calendar. Your media and feed stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep plan</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={event => { event.preventDefault(); void remove(); }}>{busy ? 'Deleting…' : 'Delete plan'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your last saved plan stays unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { setDiscardOpen(false); setEditorOpen(false); }}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={Boolean(colorVenue)} onOpenChange={open => !open && !colorBusy && setColorVenue(null)}><DialogContent className="ereza-color-dialog"><DialogHeader><DialogTitle>{colorVenue} color</DialogTitle><DialogDescription>Used across all months. Individual plans can have their own color.</DialogDescription></DialogHeader><input type="color" aria-label="Choose venue color" value={newColor || '#ffffff'} disabled={colorBusy} onChange={event => setNewColor(event.target.value)} /><Button variant="ghost" disabled={colorBusy} onClick={() => colorVenue && setNewColor(VENUE_COLORS[colorVenue])}>Restore pastel color</Button>{colorError && <p className="ereza-error" role="alert">{colorError}</p>}<DialogFooter><Button disabled={colorBusy} onClick={() => void saveColor()}>{colorBusy ? 'Saving…' : 'Save color'}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
