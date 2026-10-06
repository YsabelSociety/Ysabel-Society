'use client';
import { lazy, Suspense, useState } from 'react';
import { RefreshCw, Database, FileClock, Plug, CheckCircle2, Upload, MessageCircle, CalendarDays } from 'lucide-react';
import type { Daily, Range } from '@/lib/analytics';
import type { ReportTable } from '@/lib/reporting';
import type { SourceStatus } from '@/lib/source-status';
import type { RefreshScope } from '@/lib/refresh-scope';
import type { RefreshJob } from '@/lib/refresh-types';
import { SourceBadge } from './source-badge';
import { DataIcon } from './data-icons';
import { SourceReports } from './source-reports';
import { SyncSettings } from './sync-details';
import { HistoryImport } from './history-import';
import { CommunityDataTools } from './community';
import { ConnectionsPage, DataSourcesPage } from './system-pages';
import { AdminGate } from './admin-gate';
import type { DataCenterSection } from './data-center-navigation';
import styles from './data-center.module.css';
const SevenRoomsImports = lazy(() => import('./sevenrooms').then(module => ({default: module.SevenRoomsImportTools})));
const sections = [
  { id: 'refresh', title: 'Refresh & status', icon: RefreshCw },
  { id: 'reports', title: 'Reports & archives', icon: FileClock },
  { id: 'access', title: 'Import & access', icon: Plug },
] as const;
const sources = [
  { channel: 'Instagram', scope: 'instagram' },
  { channel: 'Facebook', scope: 'facebook' },
  { channel: 'TikTok', scope: 'tiktok' },
  { channel: 'Google Business', scope: 'gbp' },
  { channel: 'Website', scope: 'ga4' },
] as const;
export default function DataCenter({tables,rows,statuses,range,ready,busy,sync,section,onSectionChange,onRangeChange,notify}: {
  tables: ReportTable[]; rows: Daily[]; statuses: SourceStatus[]; range: Range; ready: boolean; busy: boolean;
  sync: { status: string; lastChecked?: string; job: RefreshJob|null; schedule: string|null; syncCategory: (scope: RefreshScope)=>Promise<void> };
  section: DataCenterSection; onSectionChange:(section:DataCenterSection)=>void; onRangeChange:(range:Range)=>void; notify:(text:string)=>void;
}){
  const [archive,setArchive] = useState('google');
  const verified = statuses.filter(s => s.method==='api' && s.status==='Connected' && s.autoSync && s.lastSync).length;
  const fileSources = statuses.filter(s => s.method==='file').length;
  const archives = [ ['google','Google Business'], ['website','Website'], ['social','Social media'], ['audience','Audience'], ['advertising','Advertising'] ];
  return <div className={styles.center}>
    <nav className={styles.tabs} aria-label="Data Center sections">{sections.map(({id,title,icon:Icon})=><button type="button" key={id} aria-pressed={section===id} onClick={()=>onSectionChange(id)}><Icon size={17}/><span>{title}</span></button>)}</nav>
    {section==='refresh'&&<>
      <section className={styles.hero} aria-label="Daily data refresh">
        <div><span className={styles.eyebrow}>YOUR DAILY CHECK</span><h2>Every source.<br/>One place to refresh.</h2><p>Refresh connected sources and inspect their latest checks. The dashboard stays ready while updates run.</p><button className="primary" disabled={!ready||busy} aria-busy={busy} onClick={()=>void sync.syncCategory('all')}><RefreshCw size={16}/>{busy?'Refreshing sources…':'Refresh all connected data'}</button></div>
        <div className={styles.summary}><div><CheckCircle2 size={18}/><strong>{verified}</strong><span>Verified automatic sources</span></div><div><Upload size={18}/><strong>{fileSources}</strong><span>File-only sources</span></div><div><FileClock size={18}/><strong>{tables.length}</strong><span>Available source reports</span></div></div>
      </section>
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SOURCE BY SOURCE</span><h2>A focused refresh.</h2></div><p>Provider availability and processing times still apply.</p></div>
      <div className={styles.sources}>{sources.map(({channel,scope})=>{
        const status=statuses.find(s=>s.channel===channel), imported=status?.method==='file';
        return <article key={channel} className={styles.source}><div className={styles.sourceTop}><DataIcon name={channel}/><SourceBadge channel={channel}/></div><h3>{channel}</h3><p>{status?.lastSync?'Last checked '+new Date(status.lastSync).toLocaleString():'No verified refresh recorded yet.'}</p><small>{imported?'Saved imports stay available. Upload a new export to update them.':status?.autoSync?'Automatic refresh is enabled.':'Automatic refresh is paused or not yet connected.'}</small><button className="secondary" disabled={!ready||busy} onClick={()=>imported?onSectionChange('access'):void sync.syncCategory(scope)}>{imported?<Upload size={14}/>:<RefreshCw size={14}/>}<span>{imported?'Update import':'Refresh '+channel}</span></button></article>;
      })}<article className={styles.source}><div className={styles.sourceTop}><MessageCircle size={24}/><span className={styles.smallLabel}>LAST 48 HOURS</span></div><h3>Instagram & Facebook Inbox</h3><p>Incoming and outgoing messages are checked together.</p><small>Messaging access is checked separately from account analytics.</small><button className="secondary" disabled={!ready||busy} onClick={()=>void sync.syncCategory('inbox')}><RefreshCw size={14}/>Refresh both inboxes</button></article></div>
      <SyncSettings {...sync}/>
      <HistoryImport/>
    </>}
    {section==='reports'&&<>
      <section className={styles.archiveIntro}><div><span className={styles.eyebrow}>PRESERVED SOURCE DATA</span><h2>Reports, dates & detailed records.</h2><p>Earlier exports, search terms, raw report rows, and download controls live here.</p></div><div className={styles.controls}><label>Source<select aria-label="Archive source" value={archive} onChange={e=>setArchive(e.target.value)}>{archives.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><label><CalendarDays size={14}/>From<input type="date" aria-label="Source report start date" max={range.end} value={range.start} onChange={e=>e.target.value&&e.target.value<=range.end&&onRangeChange({...range,start:e.target.value})}/></label><label>To<input type="date" aria-label="Source report end date" min={range.start} value={range.end} onChange={e=>e.target.value&&e.target.value>=range.start&&onRangeChange({...range,end:e.target.value})}/></label></div></section>
      <div className={styles.archiveBody}>
        {archive==='google'&&<SourceReports key="google" tables={tables} group="google" daily={rows}/>}
        {archive==='website'&&<SourceReports key="website" tables={tables} group="website" title="Website source reports"/>}
        {archive==='social'&&<SourceReports key="social" tables={tables.filter(t=>['instagram','facebook','tiktok','meta'].includes(t.source))} title="Social media source reports"/>}
        {archive==='audience'&&<SourceReports key="audience" tables={tables} group="audience" title="Audience source reports"/>}
        {archive==='advertising'&&<SourceReports key="advertising" tables={tables} group="advertising" title="Advertising source reports"/>}
      </div>
    </>}
    {section==='access'&&<>
      <section className={styles.accessIntro}><span className={styles.eyebrow}>CONNECTIONS & IMPORTS</span><h2>Keep the sources connected.</h2><p>Manage platform access, upload new exports, and check import history. Existing permissions and private access protection apply.</p></section>
      <CommunityDataTools/><AdminGate title="Data Center connections & imports"><ConnectionsPage notify={notify}/><section className="surface padded"><Suspense fallback={<p role="status">Opening SevenRooms import tools…</p>}><SevenRoomsImports/></Suspense></section><details className="surface padded"><summary><Database size={16}/>Source coverage & definitions</summary><DataSourcesPage/></details></AdminGate>
    </>}
  </div>;
}
