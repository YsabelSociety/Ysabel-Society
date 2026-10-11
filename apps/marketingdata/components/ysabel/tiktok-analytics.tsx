'use client';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Users, MousePointerClick, Eye, Heart, MessageCircle, Share2, UserPlus, UserMinus, TrendingUp, Link, Phone, Mail, MapPin, Download, Contact, Clock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { compact, number, type Daily, type Range, type Post } from '@/lib/analytics';
import type { ReportTable } from '@/lib/reporting';
import { SourceBadge } from './source-badge';
import { useMinimalMotion } from './use-motion';
type Measure = { key: string; label: string; color: string; icon: typeof Eye; snapshot?: boolean };
const activity: Measure[] = [
  { key: 'views', label: 'Video views', color: '#419e9b', icon: Eye },
  { key: 'profileViews', label: 'Profile visits', color: '#7d84c8', icon: Users },
  { key: 'likes', label: 'Likes', color: '#c97c9a', icon: Heart },
  { key: 'comments', label: 'Comments', color: '#6587bc', icon: MessageCircle },
  { key: 'shares', label: 'Shares', color: '#bd9651', icon: Share2 },
];
const growth: Measure[] = [
  { key: 'followers', label: 'Followers', color: '#6587bc', icon: Users, snapshot: true },
  { key: 'follows', label: 'New followers', color: '#419e9b', icon: UserPlus },
  { key: 'unfollows', label: 'Lost followers', color: '#c97c9a', icon: UserMinus },
  { key: 'netFollowers', label: 'Net follower growth', color: '#7d84c8', icon: TrendingUp },
  { key: 'reachedAudience', label: 'Daily reached audience', color: '#bd9651', icon: Eye },
  { key: 'engagedAudience', label: 'Daily engaged audience', color: '#6587bc', icon: Heart },
];
const actions: Measure[] = [
  { key: 'bioLinkClicks', label: 'Bio-link clicks', color: '#419e9b', icon: Link },
  { key: 'phoneClicks', label: 'Phone clicks', color: '#6587bc', icon: Phone },
  { key: 'emailClicks', label: 'Email clicks', color: '#7d84c8', icon: Mail },
  { key: 'addressClicks', label: 'Address clicks', color: '#bd9651', icon: MapPin },
  { key: 'leadSubmissions', label: 'Lead submissions', color: '#c97c9a', icon: Contact },
  { key: 'appClicks', label: 'App-download clicks', color: '#419e9b', icon: Download },
];
function supplied(row: Daily, key: string): number | null {
  const value = (row as unknown as Record<string, unknown>)[key];
  return row.available?.includes(key) && typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function TrendPanel({ rows, range, measures, title, detail }: { rows: Daily[]; range: Range; measures: Measure[]; title: string; detail: string }) {
  const [key, setKey] = useState(measures[0].key);
  const selected = measures.find(m => m.key === key) || measures[0];
  const id = useId().replace(/:/g, ''), motion = useMinimalMotion();
  const points = useMemo(() => {
    const byDate = new Map(rows.map(row => [row.date, row]));
    const days = [];
    for (let stamp = Date.parse(range.start); stamp <= Date.parse(range.end); stamp += 86400000) {
      const date = new Date(stamp).toISOString().slice(0, 10), row = byDate.get(date);
      days.push({ date, value: row ? supplied(row, selected.key) : null });
    }
    return days;
  }, [rows, range.start, range.end, selected.key]);
  const observed = rows.filter(row => supplied(row, selected.key) !== null).sort((a,b) => a.date.localeCompare(b.date));
  return <section className="tt-intelligence-panel">
    <div className="tt-panel-heading"><div><span className="tt-eyebrow">TIKTOK / ACCOUNT ANALYTICS</span><h2>{title}</h2><p>{detail}</p></div>
      <SourceBadge channel="TikTok" rows={observed} metric={selected.key} unavailable={!observed.length} />
    </div>
    <div className="tt-metric-choices" role="group" aria-label={title + ' metric'}>
      {measures.map(measure => {
        const matched = rows.filter(row => supplied(row, measure.key) !== null).sort((a,b) => a.date.localeCompare(b.date));
        const value = matched.length ? measure.snapshot ? supplied(matched.at(-1)!, measure.key)! : matched.reduce((sum,row) => sum + supplied(row, measure.key)!, 0) : null;
        const Icon = measure.icon;
        return <button key={measure.key} className="tt-metric-choice" aria-pressed={selected.key === measure.key}
          style={{ '--tt-accent': measure.color } as React.CSSProperties} onClick={() => setKey(measure.key)}>
          <span><Icon size={16} />{measure.label}</span><strong>{value === null ? '—' : number(value)}</strong>
          <small>{measure.snapshot && matched.length ? 'As of ' + matched.at(-1)!.date : measure.key.endsWith('Audience') ? 'Sum of daily counts' : matched.length ? matched.length + ' reported days' : 'Not supplied by TikTok'}</small>
        </button>;
      })}
    </div>
    {observed.length ? <div className="tt-main-chart" role="img" aria-label={selected.label + ' by UTC date'}>
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{top:20,right:20,left:8,bottom:8}}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={selected.color} stopOpacity={0.25}/><stop offset="100%" stopColor={selected.color} stopOpacity={0.01}/></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="rgba(90,110,115,.12)" strokeDasharray="3 7" />
        <XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} minTickGap={28} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#768280'}}/>
        <YAxis tickFormatter={compact} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#768280'}} width={54}/>
        <Tooltip formatter={(value) => [value == null ? 'Not supplied' : number(Number(value)), selected.label]} labelFormatter={value => String(value) + ' · UTC'} contentStyle={{borderRadius:14,border:'1px solid #e4eae7',fontSize:12}} />
        <Area dataKey="value" type="monotone" connectNulls={false} stroke={selected.color} strokeWidth={2.4} fill={'url(#' + id + ')'} isAnimationActive={motion} animationDuration={240} activeDot={{r:4,stroke:'#fff',strokeWidth:2}}/>
      </AreaChart></ResponsiveContainer>
    </div> : <div className="tt-data-empty"><selected.icon size={28}/><h3>{selected.label} has not been supplied yet.</h3><p>Refresh to check the connected account. Advanced insights and profile actions depend on TikTok’s account eligibility; missing data is not zero.</p></div>}
    <div className="tt-chart-footer">{observed.length ? <span>Reported {observed[0].date} – {observed.at(-1)!.date} · UTC</span> : <span>Selected {range.start} – {range.end}</span>}
      <span>{selected.key.endsWith('Audience') ? 'Daily audience counts overlap. The total is not unique people across the period.' : 'Gaps stay blank. TikTok can take 24–48 hours to process daily data.'}</span></div>
  </section>;
}
const dimensions = [
  { key: 'ages', title: 'Follower ages', column: 'age', color: '#7d84c8' },
  { key: 'genders', title: 'Follower gender', column: 'gender', color: '#c97c9a' },
  { key: 'countries', title: 'Follower countries', column: 'country', color: '#419e9b' },
  { key: 'cities', title: 'Follower cities', column: 'city_name', color: '#6587bc' },
];
function Audience({ rows, tables, range }: { rows: Daily[]; tables: ReportTable[]; range: Range }) {
  const latest = [...rows].filter(row => Array.isArray(row.sourceMetrics?.audienceActivity)).sort((a,b) => b.date.localeCompare(a.date));
  const [day, setDay] = useState('');
  const observation = latest.find(row => row.date === day) || latest[0];
  const hours = (observation?.sourceMetrics?.audienceActivity || []) as { hour: number; count: number }[];
  const max = Math.max(1, ...hours.map(hour => hour.count));
  return <div className="tt-audience">
    <TrendPanel rows={rows} range={range} measures={growth} title="Your follower community" detail="Follow daily growth, then understand the people who follow Ysabel."/>
    <div className="tt-demographics-grid">{dimensions.map(dimension => {
      const table = tables.filter(table => table.source === 'tiktok' && table.key === 'audience-tiktok-accounts-' + dimension.key)
        .sort((a,b) => String(b.observedAt || b.period.end).localeCompare(String(a.observedAt || a.period.end)))[0];
      return <section className="tt-demographic-card" key={dimension.key}>
        <div className="tt-panel-heading"><h3>{dimension.title}</h3><SourceBadge channel="TikTok" unavailable={!table}/></div>
        {table ? <><div className="tt-distribution">{table.rows.map((row,index) => <div key={index}>
          <div><span>{String(row[dimension.column])}</span><strong>{Number(row.percentage).toFixed(1)}%</strong></div>
          <span className="tt-distribution-track"><i style={{width: Number(row.percentage) + '%',background:dimension.color}}/></span>
        </div>)}</div><small>Follower snapshot · {table.observedAt ? new Date(table.observedAt).toLocaleString() : table.period.end}</small></>
        : <p className="tt-muted">Not supplied by the connected account. TikTok requires enough followers and eligible analytics access.</p>}
      </section>;
    })}</div>
    <section className="tt-intelligence-panel">
      <div className="tt-panel-heading"><div><span className="tt-eyebrow">FOLLOWER ACTIVITY</span><h2>When your followers are active</h2><p>Hourly audience activity reported by TikTok, in UTC.</p></div>
        {latest.length > 0 && <label className="tt-day-picker"><Clock size={15}/><select aria-label="Follower activity date" value={observation.date} onChange={event => setDay(event.target.value)}>{latest.map(row => <option key={row.date} value={row.date}>{row.date}</option>)}</select></label>}
      </div>
      {hours.length ? <div className="tt-hour-chart" role="img" aria-label={'Follower activity on ' + observation.date + ', UTC'}>{Array.from({length:24},(_,hour) => {
        const value = hours.find(item => item.hour === hour)?.count;
        return <div key={hour} title={hour + ':00 UTC · ' + (value == null ? 'Not supplied' : number(value) + ' followers')}><i style={{height: value == null ? 0 : Math.max(2,value / max * 100) + '%'}}/>{hour % 3 === 0 && <small>{String(hour).padStart(2,'0')}</small>}</div>;
      })}</div> : <div className="tt-data-empty"><Clock size={28}/><h3>Hourly activity has not been supplied.</h3><p>This field requires TikTok advanced analytics access.</p></div>}
    </section>
    <details className="tt-studio-note"><summary>What remains in TikTok Studio?</summary><p>Account-wide viewer demographics, new-viewer totals and search queries remain separate Studio reports. Post-specific viewer demographics, traffic sources and watch time appear in Video insights when available. Followers and viewers are different audiences.</p></details>
  </div>;
}

function VideoInsights({ posts }: { posts: Post[] }) {
  const sorted = [...posts].filter(post => post.platform === 'TikTok').sort((a,b) => (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date));
  const [id,setId] = useState('');
  const post = sorted.find(post => post.id === id) || sorted.find(post => post.sourceMetrics?.tiktokVideoAnalytics) || sorted[0];
  const analytics = post?.sourceMetrics?.tiktokVideoAnalytics as Record<string, {percentage:number;[key:string]:string|number}[]> | undefined;
  const motion = useMinimalMotion();
  const fields = [['views','Video views','count'],['reach','Reached audience','count'],['saves','Saves','count'],['followers','Followers gained','count'],
    ['profileVisits','Profile visits','count'],['websiteClicks','Website clicks','count'],['averageWatchTimeMs','Average watch time','time'],
    ['watchTimeMs','Total watch time','time'],['completionRate','Watched full video','percent']];
  const retention = (analytics?.video_view_retention || []).map(row => ({second:Number(row.second),value:row.percentage*100})).sort((a,b) => a.second-b.second);
  return <section className="tt-intelligence-panel">
    <div className="tt-panel-heading"><div><span className="tt-eyebrow">TIKTOK / VIDEO INSIGHTS</span><h2>A closer look at each post</h2><p>Posts published within your selected dates. Metrics describe each post's lifetime, including organic and paid activity.</p></div><SourceBadge channel="TikTok" unavailable={!analytics}/></div>
    {post ? <>
      <label className="tt-video-picker">Choose a post<select aria-label="TikTok video insights post" value={post.id} onChange={event => setId(event.target.value)}>{sorted.map(post => <option key={post.id} value={post.id}>{post.date} · {post.title.slice(0,100)}</option>)}</select></label>
      <div className="tt-video-heading">{post.image && <img src={post.image} alt="" loading="lazy"/>}<div><h3>{post.title}</h3><p>Published {post.date} · {post.observedAt ? 'Observed ' + new Date(post.observedAt).toLocaleString() : 'Saved observation'}</p>{post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer">Open original post ↗</a>}</div></div>
      <div className="tt-metric-choices">{fields.map(([key,label,unit]) => {
        const raw = (post as unknown as Record<string,unknown>)[key], value = post.available?.includes(key) && typeof raw === 'number' ? raw : null;
        return <div className="tt-metric-choice" key={key}><span>{label}</span><strong>{value === null ? '—' : unit === 'percent' ? value.toFixed(1)+'%' : unit === 'time' ? value >= 3600000 ? (value/3600000).toFixed(1)+'h' : value>=60000 ? (value/60000).toFixed(1)+'m' : (value/1000).toFixed(1)+'s' : number(value)}</strong><small>{value === null ? 'Not supplied by TikTok' : 'Lifetime of this post'}</small></div>;
      })}</div>
      <div className="tt-panel-heading tt-retention-heading"><div><h3>Audience retention</h3><p>People still watching at each second of the video.</p></div></div>
      {retention.length ? <div className="tt-main-chart" role="img" aria-label="Audience retention by video second"><ResponsiveContainer width="100%" height="100%"><AreaChart data={retention}>
        <CartesianGrid vertical={false} stroke="rgba(90,110,115,.12)" strokeDasharray="3 7"/>
        <XAxis dataKey="second" tickFormatter={value => value+'s'} axisLine={false} tickLine={false}/>
        <YAxis domain={[0,100]} tickFormatter={value => value+'%'} axisLine={false} tickLine={false}/>
        <Tooltip formatter={value => [Number(value).toFixed(1)+'%','Still watching']} labelFormatter={value => value+' seconds'}/>
        <Area dataKey="value" type="monotone" stroke="#419e9b" fill="#dcece6" strokeWidth={2} isAnimationActive={motion} animationDuration={240}/>
      </AreaChart></ResponsiveContainer></div> : <p className="tt-muted">Retention has not been supplied for this post. TikTok can omit insights for inactive or restricted posts.</p>}
      <div className="tt-demographics-grid tt-video-distributions">{[['impression_sources','impression_source','Traffic sources'],['audience_types','type','Viewer types'],['audience_genders','gender','Viewer gender'],['audience_countries','country','Viewer countries']].map(([key,column,title]) => <section className="tt-demographic-card" key={key}><h3>{title}</h3>{analytics?.[key]?.length ? <div className="tt-distribution">{analytics[key].map((row,index) => <div key={index}><div><span>{String(row[column]).replaceAll('_',' ').toLowerCase()}</span><strong>{(row.percentage*100).toFixed(1)}%</strong></div><span className="tt-distribution-track"><i style={{width:row.percentage*100+'%',background:'#72aaa3'}}/></span></div>)}</div> : <p className="tt-muted">Not supplied for this post.</p>}</section>)}</div>
    </> : <div className="tt-data-empty"><Eye size={28}/><h3>No TikTok posts in these dates.</h3><p>Choose a wider publication date range to explore video insights.</p></div>}
  </section>;
}

export function TikTokAnalytics({ rows, tables, range, posts, overview }: { rows: Daily[]; tables: ReportTable[]; range: Range; posts: Post[]; overview: ReactNode }) {
  const [tab, setTab] = useState('Overview');
  return <div className="tt-analytics"><Tabs value={tab} onValueChange={value => setTab(String(value))}><TabsList className="page-tabs tt-subtabs">
    <TabsTrigger value="Overview"><Activity size={15}/>Overview</TabsTrigger>
    <TabsTrigger value="Daily activity"><TrendingUp size={15}/>Daily activity</TabsTrigger>
    <TabsTrigger value="Audience"><Users size={15}/>Audience</TabsTrigger>
    <TabsTrigger value="Video insights"><Eye size={15}/>Video insights</TabsTrigger>
    <TabsTrigger value="Profile actions"><MousePointerClick size={15}/>Profile actions</TabsTrigger>
  </TabsList></Tabs>
    {tab === 'Overview' ? overview : tab === 'Daily activity' ? <TrendPanel rows={rows} range={range} measures={activity} title="TikTok, day by day" detail="Account activity for your selected dates. These counts include activity on older videos."/>
      : tab === 'Video insights' ? <VideoInsights posts={posts}/> : tab === 'Audience' ? <Audience rows={rows} tables={tables} range={range}/>
      : <TrendPanel rows={rows} range={range} measures={actions} title="From interest to action" detail="Clicks on your TikTok profile links and contact options. A click is not a verified website visit or completed booking."/>}
  </div>;
}
