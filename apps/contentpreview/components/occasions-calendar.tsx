import { useMemo, useState } from 'react';
import { CalendarHeart, ChevronLeft, ChevronRight, ExternalLink, Search, Star } from 'lucide-react';
import { occasions, occasionsToConfirm, occasionCategories, occasionThemes, eventsOnDate, eventsStartingOnDate, eventsStartingInMonth, eventsContinuingIntoMonth, OCCASION_START, OCCASION_END, OCCASION_REVIEWED, type Occasion } from '@/lib/occasions';
import './occasions-calendar.css';

const months = Array.from({ length: 17 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 8 + index, 1));
  return date.toISOString().slice(0, 7);
});
const format = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
const monthName = (month: string) => format(`${month}-01`, { month: 'long', year: 'numeric' });

function OccasionRow({ event }: { event: Occasion }) {
  return <article className={`occasion-row ${event.special ? 'occasion-row--special' : ''}`}>
    <div className="occasion-date"><strong>{format(event.date, { day: '2-digit' })}</strong><span>{format(event.date, { month: 'short', year: 'numeric' })}</span>{event.endDate && <small>to {format(event.endDate, { day: 'numeric', month: 'short' })}</small>}</div>
    <div className="occasion-description"><div className="occasion-tags">{event.special && <span className="occasion-special-badge"><Star size={12} fill="currentColor" />Special · Ysabel Society</span>}<span>{event.category}</span><span className={event.status === 'Tentative' ? 'occasion-tentative' : ''}>{event.status}</span></div><h3>{event.title}</h3><small>{event.region}</small><div className="occasion-theme-tags">{event.themes.map(theme => <span key={theme}>{theme}</span>)}</div><p>{event.idea}</p>{event.source ? <a href={event.source} target="_blank" rel="noopener noreferrer">Check source <ExternalLink size={12} /></a> : <small>Birthday date confirmed by Ysabel Society</small>}</div>
  </article>;
}

export default function OccasionsCalendar() {
  const today = new Date().toLocaleDateString('en-CA');
  const [month, setMonth] = useState(months.includes(today.slice(0, 7)) ? today.slice(0, 7) : months[0]);
  const [view, setView] = useState<'month' | 'all'>('month');
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All occasions');
  const [theme, setTheme] = useState('All themes');
  const filtered = useMemo(() => occasions.filter(event => (category === 'All occasions' || event.category === category) && (theme === 'All themes' || event.themes.some(item => item === theme)) && `${event.title} ${event.region} ${event.idea} ${event.themes.join(' ')}`.toLowerCase().includes(query.toLowerCase().trim())), [query, category, theme]);
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const monthly = eventsStartingInMonth(month, filtered);
  const continuing = eventsContinuingIntoMonth(month, filtered);
  const listed = view === 'all' ? filtered : selected ? eventsOnDate(selected, filtered) : monthly;
  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const dayCount = Number(monthEnd.slice(-2));
  const monthIndex = months.indexOf(month);
  function changeMonth(next: string) { setMonth(next); setSelected(null); }

  return <section className="occasions-page" aria-labelledby="occasions-title">
    <header className="occasions-heading"><div className="occasions-eyebrow"><CalendarHeart size={17} /> THE SOCIETY ALMANAC</div><h1 id="occasions-title">Occasions & celebrations</h1><p>Meaningful dates. Thoughtful gatherings. A little inspiration for what comes next.</p><small>September 2026 — New Year’s Day 2028 · {occasions.length} curated occasions</small></header>
    <div className="occasions-theme-filter" role="group" aria-label="Ysabel theme">{['All themes', ...occasionThemes].map(item => <button key={item} aria-pressed={theme === item} onClick={() => { setTheme(item); setSelected(null); }}>{item}</button>)}</div>
    <div className="occasions-tools"><div className="occasions-segment" aria-label="Calendar view"><button aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button><button aria-pressed={view === 'all'} onClick={() => setView('all')}>All dates</button></div><label className="occasions-search"><Search size={16} /><input aria-label="Search occasions" placeholder="Search occasions, places, ideas…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Occasion category" value={category} onChange={e => setCategory(e.target.value)}><option>All occasions</option>{occasionCategories.map(item => <option key={item}>{item}</option>)}</select></div>
    {view === 'month' && <div className="occasions-month"><div className="occasions-month-bar"><button aria-label="Previous month" disabled={monthIndex === 0} onClick={() => changeMonth(months[monthIndex - 1])}><ChevronLeft size={18} /></button><select aria-label="Choose occasion month" value={month} onChange={e => changeMonth(e.target.value)}>{months.map(item => <option key={item} value={item}>{monthName(item)}</option>)}</select><button aria-label="Next month" disabled={monthIndex === months.length - 1} onClick={() => changeMonth(months[monthIndex + 1])}><ChevronRight size={18} /></button></div>
      <div className="occasions-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="occasions-days">{Array.from({ length: offset }, (_, i) => <div className="occasion-blank" key={`blank-${i}`} />)}{Array.from({ length: dayCount }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const events = eventsStartingOnDate(date, filtered);
        const special = events.some(event => event.special);
        const outside = date < OCCASION_START || date > OCCASION_END;
        return <button key={date} disabled={outside} className={`occasion-day ${selected === date ? 'selected' : ''} ${date === today ? 'today' : ''} ${special ? 'occasion-day--special' : ''}`} aria-pressed={selected === date} aria-label={`${format(date, { dateStyle: 'full' })}, ${events.length} occasions starting${special ? ', special: Ysabel Society Birthday' : ''}${outside ? ', outside planning range' : ''}`} onClick={() => setSelected(selected === date ? null : date)}><span className="occasion-day-number">{i + 1}</span>{special && <Star className="occasion-special-star" size={13} fill="currentColor" aria-hidden="true" />}<span className="occasion-day-events">{events.slice(0, 2).map(event => <span key={event.id}>{event.title}{event.endDate && <em>Until {format(event.endDate, { day: 'numeric', month: 'short' })}</em>}</span>)}{events.length > 2 && <small>+{events.length - 2} more</small>}</span>{events.length > 0 && <span className="occasion-day-dot" aria-hidden="true" />}</button>;
      })}</div><p className="occasions-calendar-hint">Multi-day events appear once, on their start date. Select any date to see what starts or is still running.</p></div>}
    {view === 'month' && !selected && continuing.length > 0 && <div className="occasions-continuing"><h2>Continuing from last month</h2><p>Already started — shown here once, with the full date range.</p>{continuing.map(event => <OccasionRow key={event.id} event={event} />)}</div>}
    <div className="occasions-list-heading"><h2>{view === 'all' ? 'The complete almanac' : selected ? format(selected, { day: 'numeric', month: 'long', year: 'numeric' }) : `In ${monthName(month)}`}</h2><span>{listed.length} occasions</span>{selected && view === 'month' && <button onClick={() => setSelected(null)}>Show whole month</button>}</div>
    <div className="occasions-list" aria-live="polite">{listed.map(event => <OccasionRow key={event.id} event={event} />)}{!listed.length && <p className="occasions-empty">No matching occasions here. Try another date or adjust your filters.</p>}</div>
    <details className="occasions-watch"><summary>Dates to confirm <span>{occasionsToConfirm.length} planning ideas</span></summary><p>Keep these on the radar. No dates have been assumed.</p>{occasionsToConfirm.map(event => <article key={event.title}><h3>{event.title}</h3><small>{event.region}</small><p>{event.idea}</p><a href={event.source} target="_blank" rel="noopener noreferrer">Check organiser <ExternalLink size={12} /></a></article>)}</details>
    <footer className="occasions-footnote">Curated for Ysabel Society: Kosovo, Albania and international hospitality, food, drink and culture. Theme tags and menu ideas are editorial recommendations, not claims about the current menu. Annual occasions return in each year; multi-day events are not separate daily celebrations. Industry-led observances and informal occasions are not public holidays. Not an exhaustive worldwide calendar or a confirmed Ysabel events programme. Dates refer to celebrations, not substitute bank closures. Lunar observances marked tentative require local confirmation. Sources reviewed {format(OCCASION_REVIEWED, { day: 'numeric', month: 'long', year: 'numeric' })}; this calendar does not update automatically.</footer>
  </section>;
}
