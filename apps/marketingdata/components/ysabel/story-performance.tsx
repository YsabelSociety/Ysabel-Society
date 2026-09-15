'use client';
import { useState } from 'react';
import { calendarDate } from '@/lib/sync-window';
import { number, postAvailable, type Post } from '@/lib/analytics';
import { useSourceAnalytics } from './use-analytics';
import { DataIcon } from './data-icons';
import { MediaCards } from './content';
import { ImportedPostDetail } from './imported-post-detail';
import { Bars } from './charts';

const metrics = [
  ['linkClicks','Story link clicks'], ['views','Views'], ['reach','Reach across stories'],
  ['replies','Replies'], ['navigation','Navigation actions'], ['totalInteractions','Total interactions'],
  ['likes','Likes'], ['comments','Comments'], ['saves','Saves'], ['shares','Shares'],
  ['reshares','Reshares'], ['reposts','Reposts'], ['followers','Followers gained'],
  ['profileVisits','Profile visits'], ['visits','Website visits'], ['mediaViewers','Unique media viewers per story'],
  ['averageWatchTimeMs','Average watch time per story · ms'], ['watchTimeMs','Total watch time · ms'],
];

export function StoryPerformance({platform}:{platform:'Instagram'|'Facebook'}) {
  const [period, setPeriod] = useState('This Month');
  const [selected, setSelected] = useState<Post | null>(null);
  const today = calendarDate('Europe/Tirane');
  const date = new Date(today + 'T12:00:00Z');
  if (period === 'Yesterday') date.setUTCDate(date.getUTCDate() - 1);
  if (period === 'This Week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const start = period === 'This Month' ? today.slice(0, 7) + '-01' : date.toISOString().slice(0, 10);
  const end = period === 'Yesterday' ? start : today;
  const source = useSourceAnalytics('Ysabel Society', {start,end}, 'No Comparison');
  const stories = source.posts.filter(p => p.origin && p.status === 'Published' && p.format === 'Story' &&
    p.platform === platform);
  const supplied = (key:string) => stories.filter(p => postAvailable(p,key));
  const value = (p:Post,key:string) => Number((p as unknown as Record<string,unknown>)[key] || 0);
  const days = [...new Set(stories.map(p=>p.date.slice(0,10)))].sort();
  const linkDays = days.map(day=>({label:day,posts:supplied('linkClicks').filter(p=>p.date.slice(0,10)===day)})).filter(d=>d.posts.length);
  return <section aria-label={platform + ' story performance'}>
    <div className="section-head"><div><h2>{platform} Stories</h2><p>Link clicks and results from published stories</p></div></div>
    <div className="studio-toolbar">
      <div className="inline-controls">{['Today','Yesterday','This Week','This Month'].map(label=><button className={period===label?'primary':'secondary'} aria-pressed={period===label} key={label} onClick={()=>setPeriod(label)}>{label}</button>)}</div>
    </div>
    <p className="footnote">Stories published {start} – {end} · Europe/Tirane calendar · lifetime results observed at sync, not clicks that occurred only within these dates. Link clicks are taps, not unique visitors; the destination may be a website or another link.</p>
    {(source.loading||source.refreshing)&&<p role="status">Updating story results…</p>}
    {source.error&&<p role="alert">{source.error}</p>}
    <div className="story-summary-cards">{metrics.map(([key,label])=>{
      const available=supplied(key);const total=available.reduce((n,p)=>n+value(p,key),0);
      return <article className="surface story-summary-card" key={key} data-primary={key==='linkClicks'}>
        <div><DataIcon name={key==='linkClicks'?'Website':label}/><span>{label}</span></div>
        <strong>{available.length?number(key==='averageWatchTimeMs'?total/available.length:total):'—'}</strong>
        <small>{available.length?`${available.length} of ${stories.length} stories supplied this metric`:'Not supplied for this selection'}</small>
      </article>;
    })}</div>
    <p className="footnote">Reach and unique viewers are added per story and can count the same person again. Average watch time is an unweighted average of reported story averages. Missing metrics are not treated as zero.</p>
    <section className="surface padded"><h3>Link clicks by story publication date</h3>{linkDays.length?<Bars items={linkDays.map(d=>({label:d.label,value:d.posts.reduce((n,p)=>n+value(p,'linkClicks'),0)}))}/>:<p>No link-click metrics supplied for these stories.</p>}</section>
    <p className="footnote">{platform}: {stories.length} captured stories. No captured stories does not mean no stories were published.</p>
    <MediaCards posts={stories} deferPreviews onSelect={setSelected}/>
    {selected&&<ImportedPostDetail post={selected} close={()=>setSelected(null)}/>}
  </section>;
}
