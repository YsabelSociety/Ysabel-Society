'use client';
import {
  Camera as Instagram,
  Flag as Facebook,
  Music2,
  MapPin,
  Globe,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  CHANNELS,
  COLORS,
  METRICS,
  metricAvailable,
  postAvailable,
  compact,
  total,
  change,
  series,
  type Daily,
  type Post,
  type Range,
} from '@/lib/analytics';
import { Help } from './controls';
import { AnalyticsChart, Spark } from './charts';
import { MediaCards, Media } from './content';
import { useState, useEffect } from 'react';
import { calendarDate } from '@/lib/sync-window';
import { IntelligenceScene } from './intelligence-scene';
import { ProfileViews, ChannelTimeline } from './activity-panels';
import { DataIcon } from './data-icons';
import { GoogleRating } from './google-rating';
import { PlatformCardChart } from './platform-card-chart';
import { SourceBadge } from './source-badge';
export default function Overview({
  rows,
  range,
  previous,
  setPage,
  posts,
  monthlyPosts = [],
  onSelect,
  onMetric,
  live = false,
  sceneEnabled = true,
}: {
  rows: Daily[];
  range: Range;
  previous: Daily[];
  setPage: (p: string) => void;
  posts: Post[];
  monthlyPosts?: Post[];
  onSelect: (p: Post) => void;
  onMetric: (key: string) => void;
  live?: boolean;
  sceneEnabled?: boolean;
}) {
  const tiktokPosts = posts.filter(
    (p) =>
      p.platform === 'TikTok' &&
      p.status === 'Published' &&
      (!p.available || p.available.includes('views')),
  );
  const tiktokViews = tiktokPosts.reduce((n, p) => n + p.views, 0);
  const tiktokContent =
    !metricAvailable(
      rows.filter((r) => r.channel === 'TikTok'),
      'views',
    ) && tiktokPosts.length > 0;
  const month = calendarDate('Europe/Tirane').slice(0,7);
  const highlights = monthlyPosts.filter(p => p.status === 'Published' && p.date.startsWith(month) && ['Instagram','Facebook','TikTok'].includes(p.platform)).sort((a,b) => (b.views||0)-(a.views||0));
  return (
    <>
      <AllPlatformViews
        rows={rows}
        previous={previous}
        tiktokPosts={tiktokPosts}
        range={range}
        onOpen={() => setPage('Performance')}
        onReviews={() => setPage('Google Business')}
      />
      <ProfileViews rows={rows} previous={previous} />
      <div className="metrics-strip">
        {METRICS.filter((m) => m.key !== 'profileViews').map((m, i) => {
          const metricRows =
              m.key === 'search'
                ? rows.filter((r) => r.channel === 'Google Business')
                : m.key === 'sessions'
                  ? rows.filter((r) => r.channel === 'Website')
                  : rows,
            previousRows =
              m.key === 'search'
                ? previous.filter((r) => r.channel === 'Google Business')
                : m.key === 'sessions'
                  ? previous.filter((r) => r.channel === 'Website')
                  : previous,
            value = total(metricRows, m.key),
            prior = total(previousRows, m.key),
            delta = change(value, prior),
            available = metricAvailable(metricRows, m.key);
          return (
            <div
              className={'metric-card metric-' + i}
              data-metric={m.key}
              key={m.key}
            >
              <div className="metric-label">
                <DataIcon name={m.key} badge />
                {m.label}
                <Help text={m.definition} />
              </div>
              <button
                className="metric-value"
                onClick={() => onMetric(m.key)}
                aria-label={
                  m.label +
                  ': ' +
                  (available ? compact(value) : 'Unavailable') +
                  '. Open metric details.'
                }
              >
                {available ? compact(value) : '—'}
              </button>
              <div className="metric-bottom">
                <span className={delta >= 0 ? 'positive' : 'negative'}>
                  {available && prior ? (delta >= 0 ? '↗' : '↘') : ''}{' '}
                  {prior ? Math.abs(delta).toFixed(1) + '%' : '—'}
                </span>
                <span>
                  {!available
                    ? 'Not supplied'
                    : prior
                      ? 'vs. previous'
                      : 'no comparison'}
                </span>
              </div>
              {available && (
                <Spark
                  values={series(metricRows, m.key).map((d) => Number(d.total))}
                />
              )}
            </div>
          );
        })}
      </div>
      <ChannelTimeline rows={rows} posts={posts} range={range} />
      <section className="content-highlights" aria-label="Content Intelligence highlights">
        <div className="section-head"><div><span className="eyebrow">CONTENT INTELLIGENCE</span><h2>Posts earning attention</h2><p>All imported Instagram, Facebook and TikTok posts this month · lifetime views</p></div><button type="button" className="text-link" onClick={() => setPage('Content Intelligence')}>Explore content <ArrowUpRight size={16}/></button></div>
        <div className="content-highlight-grid">{highlights.map((post,index) => <button type="button" className="content-highlight" key={post.id} data-platform={post.platform} onClick={() => onSelect(post)}>
          <div className="highlight-media"><Media post={post}/><span className="highlight-format">{post.format}</span></div><div className="highlight-top"><DataIcon name={post.platform} badge/><span>{post.platform}</span><span className="highlight-rank">0{index+1}</span></div>
          <h3>{post.title || 'Published content'}</h3><span className="muted">{post.format} · {post.date.slice(0,10)}</span>
          <div className="highlight-result"><strong>{postAvailable(post,'views') ? compact(post.views) : '—'}</strong><span>views</span><ArrowUpRight size={18}/></div>
          <span className="highlight-detail">{postAvailable(post,'shares') ? compact(post.shares)+' shares' : 'View available metrics'}{postAvailable(post,'saves') ? ' · '+compact(post.saves)+' saves' : ''}</span>
        </button>)}</div>
        {!highlights.length && <p className="muted">No social posts have been imported for the current month yet.</p>}
      </section>

      <OverviewIntelligence rows={rows} tiktokContent={tiktokContent} tiktokViews={tiktokViews} live={live} sceneEnabled={sceneEnabled} setPage={setPage} />
      <div className="section-head standalone">
        <div>
          <h2>Channel performance</h2>
          <p>Five perspectives. One connected story.</p>
        </div>
        <button className="text-link" onClick={() => setPage('Performance')}>
          Explore channels <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="channel-grid">
        {CHANNELS.map((c, i) => {
          const Icon = [Instagram, Facebook, Music2, MapPin, Globe][i],
            cr = rows.filter((r) => r.channel === c),
            prior =
              c === 'TikTok' && tiktokContent
                ? 0
                : total(
                    previous.filter((r) => r.channel === c),
                    i < 3 ? 'views' : i === 3 ? 'search' : 'sessions',
                  ),
            available =
              (c === 'TikTok' && tiktokContent) ||
              metricAvailable(
                cr,
                i < 3 ? 'views' : i === 3 ? 'search' : 'sessions',
              );
          return (
            <button
              className="channel-card surface"
              data-platform={c}
              key={c}
              onClick={() =>
                setPage(
                  c === 'Website'
                    ? 'Website'
                    : c === 'Google Business'
                      ? 'Google Business'
                      : 'Performance',
                )
              }
            >
              <div className="channel-name">
                <span className="channel-icon" style={{ color: COLORS[i] }}>
                  <Icon size={19} />
                </span>
                {c}
                <ArrowUpRight size={14} />
              </div>
              <strong>
                {available
                  ? c === 'TikTok' && tiktokContent
                    ? compact(tiktokViews)
                    : compact(
                        total(
                          cr,
                          i < 3 ? 'views' : i === 3 ? 'search' : 'sessions',
                        ),
                      )
                  : '—'}
              </strong>
              <span>
                {i < 3
                  ? c === 'TikTok' && tiktokContent
                    ? 'Video views · lifetime'
                    : 'Daily content views'
                  : i === 3
                    ? 'Google Search views'
                    : 'Website visits'}
              </span>
              <div className="channel-footer">
                {available ? (
                  <>
                    {prior ? (
                      <span className="positive">
                        {total(
                          cr,
                          i < 3 ? 'views' : i === 3 ? 'search' : 'sessions',
                        ) >= prior
                          ? '↗'
                          : '↘'}{' '}
                        {change(
                          total(
                            cr,
                            i < 3 ? 'views' : i === 3 ? 'search' : 'sessions',
                          ),
                          total(
                            previous.filter((r) => r.channel === c),
                            i < 3 ? 'views' : i === 3 ? 'search' : 'sessions',
                          ),
                        ).toFixed(1)}
                        %
                      </span>
                    ) : (
                      <span className="muted">No complete comparison</span>
                    )}
                    <Spark
                      values={series(
                        cr,
                        i < 3 ? 'views' : i === 3 ? 'search' : 'sessions',
                      ).map((d) => Number(d.total))}
                    />
                  </>
                ) : (
                  <span className="muted">Daily metrics not supplied</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!live && (
        <>
          <div className="section-head standalone">
            <div>
              <h2>Content worth a closer look</h2>
              <p>The stories that resonated most.</p>
            </div>
            <button
              className="text-link"
              onClick={() => setPage('Content Intelligence')}
            >
              All content <ArrowUpRight size={14} />
            </button>
          </div>
          <MediaCards
            posts={posts
              .filter((p) => p.status === 'Published')
              .sort((a, b) => b.views - a.views)
              .slice(0, 4)}
            onSelect={onSelect}
          />
          <p className="footnote">
            Demo media · licensed hospitality photographs. These images do not
            depict Ysabel Society or its team.
          </p>
        </>
      )}
    </>
  );
}

// Keep the five-second editorial cycle independent of the report/chart tree.
function OverviewIntelligence({ rows, tiktokContent, tiktokViews, live, sceneEnabled, setPage }: { rows: Daily[]; tiktokContent: boolean; tiktokViews: number; live: boolean; sceneEnabled: boolean; setPage: (page: string) => void }) {
  const [activeSignal, setActiveSignal] = useState(0);
  useEffect(() => {const timer=setInterval(()=>{if(!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches)setActiveSignal(i=>(i+1)%3);},5000);return()=>clearInterval(timer);},[]);
  const signals = [0,2,4].map((idx,i)=>{const cr=rows.filter(r=>r.channel===CHANNELS[idx]);const key=idx===4?'sessions':'views';return {title:['Momentum','Channel spotlight','Beyond social'][i],value:metricAvailable(cr,key)?compact(total(cr,key)):idx===2&&tiktokContent?compact(tiktokViews):'—',detail:CHANNELS[idx]+' · '+(idx===4?'website visits':'content views')};});
  return (
      <div className="overview-intelligence">
        <section className="intelligence surface">
          <div className="section-head">
            <h2>
              <Sparkles size={16} /> Digital Intelligence
            </h2>
            <span className="pill">{live ? 'LIVE' : 'PREVIEW'}</span>
          </div>
          <p className="intelligence-intro">The story behind the numbers.</p>
<div className="intelligence-composition"><div className="intelligence-signals">
          {[0, 2, 4].map((idx, i) => {
            const c = CHANNELS[idx],
              v = total(
                rows.filter((r) => r.channel === c),
                idx === 4 ? 'sessions' : 'views',
              );
            return (
              <button
                key={c}
                className="insight-row"
                data-active={activeSignal === i}
                onMouseEnter={() => setActiveSignal(i)}
                onFocus={() => setActiveSignal(i)}
                onClick={() => setPage('Insights')}
              >
                <span className="insight-kicker">
                  {['MOMENTUM', 'CHANNEL SPOTLIGHT', 'BEYOND SOCIAL'][i]}
                </span>
                <p>
                  {c}{' '}
                  <strong>
                    {metricAvailable(
                      rows.filter((r) => r.channel === c),
                      idx === 4 ? 'sessions' : 'views',
                    )
                      ? compact(v)
                      : idx === 2 && tiktokContent
                        ? compact(tiktokViews)
                        : '—'}
                  </strong>{' '}
                  {idx === 2 && tiktokContent
                    ? 'lifetime views on videos published in this period.'
                    : (idx === 4 ? 'website visits' : 'content views') +
                      ' this period.'}
                </p>
                <span>
                  Explore the signal <ArrowUpRight size={13} />
                </span>
              </button>
            );
          })}
          </div>{sceneEnabled ? <IntelligenceScene active={activeSignal} signals={signals}/> : <div className="intelligence-art" aria-hidden="true" />}</div>
          <button className="text-link" onClick={() => setPage('Insights')}>
            Open intelligence <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
  );
}

type ViewSource = {
  channel: (typeof CHANNELS)[number];
  metric: 'views' | 'search' | 'pageViews';
  label: string;
};

const VIEW_SOURCES: ViewSource[] = [
  { channel: 'Instagram', metric: 'views', label: 'Content views' },
  { channel: 'Facebook', metric: 'views', label: 'Content views' },
  { channel: 'TikTok', metric: 'views', label: 'Video views' },
  { channel: 'Google Business', metric: 'search', label: 'Search views' },
  { channel: 'Website', metric: 'pageViews', label: 'Page views' },
];

function reported(rows: Daily[], metric: ViewSource['metric']) {
  return rows.some(row =>
    row.available
      ? row.available.includes(metric)
      : Number.isFinite(row[metric]) && Number(row[metric]) > 0,
  );
}

function AllPlatformViews({
  rows,
  previous,
  tiktokPosts,
  range,
  onOpen,
  onReviews,
}: {
  rows: Daily[];
  previous: Daily[];
  tiktokPosts: Post[];
  range: Range;
  onOpen: () => void;
  onReviews: () => void;
}) {
  const sources = VIEW_SOURCES.map(source => {
    const currentRows = rows.filter(row => row.channel === source.channel);
    const previousRows = previous.filter(row => row.channel === source.channel);
    const hasDaily = reported(currentRows, source.metric);
    const fallback = source.channel === 'TikTok' && !hasDaily
      ? tiktokPosts.reduce((sum, post) => sum + Number(post.views || 0), 0)
      : 0;
    return {
      ...source,
      hasDaily,
      available: hasDaily || fallback > 0,
      value: hasDaily ? total(currentRows, source.metric) : fallback,
      previous: reported(previousRows, source.metric)
        ? total(previousRows, source.metric)
        : null,
    };
  });
  const combined = sources.filter(source => source.available).reduce((sum, source) => sum + source.value, 0);
  const priorValues = sources.map(source => source.previous).filter((value): value is number => value !== null);
  const prior = priorValues.reduce((sum, value) => sum + value, 0);
  const delta = prior > 0 ? change(combined, prior) : null;
  const dates = [...new Set([
    ...rows.map(row => row.date),
    ...tiktokPosts.map(post => post.date.slice(0, 10)),
  ])].sort();
  const trend = dates.map(date => sources.reduce((sum, source) => {
    const dated = rows.filter(row => row.channel === source.channel && row.date === date);
    if (reported(dated, source.metric)) return sum + total(dated, source.metric);
    if (source.channel === 'TikTok' && source.metric === 'views')
      return sum + tiktokPosts.filter(post => post.date.slice(0, 10) === date).reduce((value, post) => value + Number(post.views || 0), 0);
    return sum;
  }, 0));
  const supporting = [
    { name: 'Profile views', key: 'profileViews' as const },
    { name: 'Reach', key: 'reach' as const },
    { name: 'Engagements', key: 'engagements' as const },
  ].map(item => ({ ...item, value: metricAvailable(rows, item.key) ? total(rows, item.key) : null }));
  return (
    <section className="all-views-hero" aria-label="All connected platform views">
      <div className="all-views-summary">
        <span className="metric-eyebrow">ALL CONNECTED CATEGORIES · {range.start} – {range.end}</span>
        <h1>All-platform views</h1>
        <button type="button" className="all-views-total" onClick={onOpen}>
          {sources.some(source => source.available) ? compact(combined) : '—'}
          <ArrowUpRight size={22} />
        </button>
        <p>Social content, Google Search discovery and website page views in one current-period view.</p>
        {trend.some(Boolean) && <Spark values={trend} />}
        <div className="all-views-supporting">
          {supporting.map(item => <span key={item.key}><small>{item.name}</small><strong>{item.value === null ? '—' : compact(item.value)}</strong></span>)}
          <span><small>Change</small><strong className={delta !== null && delta < 0 ? 'negative' : 'positive'}>{delta === null ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%'}</strong></span>
        </div>
      </div>
      <div className="all-views-platforms">
        {sources.map((source, index) => (
          <button type="button" key={source.channel} data-platform={source.channel} onClick={onOpen}>
            <span className="all-views-brand"><DataIcon name={source.channel} badge /><strong>{source.channel}</strong></span>
            <SourceBadge channel={source.channel} rows={rows.filter(r => r.channel === source.channel)} />
            <strong>{source.available ? compact(source.value) : '—'}</strong>
            <small>{source.available ? source.label : 'Not supplied for this period'}</small>
            <PlatformCardChart color={COLORS[index]} bars={source.channel === 'TikTok' || source.channel === 'Google Business'} lifetime={source.channel === 'TikTok' && !source.hasDaily} points={dates.map(date => {
              const dated = rows.filter(row => row.channel === source.channel && row.date === date);
              const published = tiktokPosts.filter(post => post.date.slice(0,10) === date);
              return {date,value:source.hasDaily ? (reported(dated,source.metric) ? total(dated,source.metric) : null) : source.channel === 'TikTok' && published.length ? published.reduce((n,p)=>n+p.views,0) : null};
            })}/>
            <i style={{ background: COLORS[index] }} />
          </button>
        ))}
      </div>
      <GoogleRating onOpen={onReviews} />
    </section>
  );
}
