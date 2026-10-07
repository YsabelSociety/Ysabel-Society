"use client";
import { ArrowUpRight, CalendarDays, TrendingUp, TrendingDown, UserRound, ScanEye, Heart } from 'lucide-react';
import type { CSSProperties } from 'react';
import { CHANNELS, compact, total, change, metricAvailable, type Daily, type Post, type Range } from '@/lib/analytics';
import { DataIcon } from './data-icons';
import { GoogleRating } from './google-rating';
import { PlatformCardChart } from './platform-card-chart';
import { SourceBadge } from './source-badge';
import { YsabelBuilding } from './ysabel-building';
import styles from './overview-maison.module.css';

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

export function AllPlatformViews({
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
  const delta = prior > 0 && sources.some(source => source.available) ? change(combined, prior) : null;
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
  const palette = ['#a76593', '#6c8eaf', '#589497', '#759d89', '#5e8782'];
  const platformCard = (source: (typeof sources)[number], index: number) => (
    <button type="button" className={styles.platform} key={source.channel} data-platform={source.channel} onClick={onOpen} style={{ '--platform': palette[index] } as CSSProperties}>
      <span className={styles.brand}><DataIcon name={source.channel} badge/><strong>{source.channel}</strong><ArrowUpRight size={14}/></span>
      <div className={styles.platformData}>
        <span><strong title={source.available ? source.value.toLocaleString() : undefined}>{source.available ? compact(source.value) : '—'}</strong><small>{source.available ? source.channel === 'TikTok' && !source.hasDaily ? 'Lifetime video views' : source.label : 'Not supplied for this period'}</small></span>
        <PlatformCardChart color={palette[index]} bars={source.channel === 'TikTok' || source.channel === 'Google Business'} lifetime={source.channel === 'TikTok' && !source.hasDaily} points={dates.map(date => {
          const dated = rows.filter(row => row.channel === source.channel && row.date === date);
          const published = tiktokPosts.filter(post => post.date.slice(0,10) === date);
          return { date, value: source.hasDaily ? (reported(dated, source.metric) ? total(dated, source.metric) : null) : source.channel === 'TikTok' && published.length ? published.reduce((n,p) => n + p.views, 0) : null };
        })}/>
      </div>
      <span className={styles.platformFooter}><SourceBadge channel={source.channel} metric={source.metric} unavailable={!source.available} rows={rows.filter(r => r.channel === source.channel)}/><span>{source.channel === 'TikTok' && !source.hasDaily && source.available ? 'Lifetime · published in period' : source.label}</span></span>
    </button>
  );
  return (
    <section className={styles.hero} aria-label="All connected platform views">
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>YSABEL SOCIETY · THE CONNECTED PICTURE</span><h2>One house. Every connection.</h2></div>
        <div className={styles.period}><CalendarDays size={14}/><span>{range.start} — {range.end}</span></div>
      </header>
      <div className={styles.layout}>
        <div className={styles.leftRail}>
          <div className={styles.totalCard}>
            <div className={styles.totalHeading}><span className={styles.eyebrow}>ALL-PLATFORM VIEWS</span><button type="button" aria-label="Explore platform performance" onClick={onOpen}><ArrowUpRight size={19}/></button></div>
            <div className={styles.totalBody}>
              <strong className={styles.totalNumber} title={sources.some(source => source.available) ? combined.toLocaleString() : undefined}>{sources.some(source => source.available) ? compact(combined) : '—'}</strong>
              <p>Social content, Search discovery<br/>and website activity.</p>
              <div className={styles.totalTrend}>{trend.some(Boolean) && <PlatformCardChart points={dates.map((date,i) => ({ date, value: trend[i] }))} color="#789589"/>}{delta !== null && <span className={styles.change}>{delta >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% <small>vs previous period</small></span>}</div>
            </div>
            <div className={styles.supporting}>
              {supporting.map((item,i) => <div key={item.key}>{i === 0 ? <UserRound size={14}/> : i === 1 ? <ScanEye size={14}/> : <Heart size={14}/>}<span><small>{item.name}</small><strong>{item.value === null ? '—' : compact(item.value)}</strong></span></div>)}
            </div>
          </div>
          {sources.slice(0,2).map((source,index) => platformCard(source,index))}
        </div>
        <div className={styles.scene}><YsabelBuilding/></div>
        <div className={styles.rightRail}>
          {sources.slice(2).map((source,index) => platformCard(source,index + 2))}
          <div className={styles.rating}><GoogleRating onOpen={onReviews}/></div>
        </div>
      </div>
    </section>
  );
}
