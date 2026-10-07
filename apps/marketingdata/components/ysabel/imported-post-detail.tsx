'use client';
import { useState } from 'react';
import {
  ArrowUpRight, Bookmark, CalendarDays, ChartColumnIncreasing, ChevronDown,
  CircleUserRound, Clock3, Eye, Heart, Image, MessageCircle, MousePointerClick,
  Play, Radar, Repeat2, Share2, UserRoundPlus, Video, X, type LucideIcon,
} from 'lucide-react';
import { type Post, postAvailable, number } from '@/lib/analytics';
import { DataIcon } from './data-icons';
import {
  Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import styles from './imported-post-detail.module.css';

type Metric = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: 'blue' | 'green' | 'rose' | 'violet' | 'gold';
  group: 'Interactions' | 'Audience & actions' | 'Video & viewing';
};

function recordedDate(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  return {
    day: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Tirane' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Tirane' }),
  };
}

export function ImportedPostDetail({ post, close }: { post: Post; close: () => void }) {
  const [failedMedia, setFailedMedia] = useState('');
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const extra = post as unknown as Record<string, unknown>;
  const metrics: Metric[] = [
    { key: 'views', label: 'Views', icon: Eye, tone: 'blue', group: 'Video & viewing' },
    { key: 'reach', label: 'Reach', icon: Radar, tone: 'green', group: 'Audience & actions' },
    { key: 'totalInteractions', label: 'Total interactions', icon: ChartColumnIncreasing, tone: 'violet', group: 'Interactions' },
    { key: 'likes', label: post.platform === 'Facebook' ? 'Reactions' : 'Likes', icon: Heart, tone: 'rose', group: 'Interactions' },
    { key: 'comments', label: 'Comments', icon: MessageCircle, tone: 'blue', group: 'Interactions' },
    { key: 'saves', label: 'Saves', icon: Bookmark, tone: 'gold', group: 'Interactions' },
    { key: 'shares', label: 'Shares', icon: Share2, tone: 'green', group: 'Interactions' },
    { key: 'reshares', label: 'Reshares', icon: Repeat2, tone: 'violet', group: 'Interactions' },
    { key: 'reposts', label: 'Reposts', icon: Repeat2, tone: 'violet', group: 'Interactions' },
    { key: 'replies', label: 'Story replies', icon: MessageCircle, tone: 'rose', group: 'Interactions' },
    { key: 'navigation', label: 'Story navigation', icon: Play, tone: 'blue', group: 'Interactions' },
    { key: 'linkClicks', label: 'Story link clicks', icon: MousePointerClick, tone: 'gold', group: 'Audience & actions' },
    { key: 'followers', label: 'Followers gained', icon: UserRoundPlus, tone: 'green', group: 'Audience & actions' },
    { key: 'visits', label: 'Website visits', icon: MousePointerClick, tone: 'gold', group: 'Audience & actions' },
    { key: 'profileVisits', label: 'Profile visits', icon: CircleUserRound, tone: 'violet', group: 'Audience & actions' },
    { key: 'mediaViewers', label: 'Unique viewers', icon: Eye, tone: 'green', group: 'Video & viewing' },
    { key: 'averageWatchTimeMs', label: 'Average watch time', icon: Clock3, tone: 'blue', group: 'Video & viewing' },
    { key: 'watchTimeMs', label: 'Total watch time', icon: Clock3, tone: 'violet', group: 'Video & viewing' },
    { key: 'reelsSkipRate', label: 'Reel skip rate', icon: Video, tone: 'rose', group: 'Video & viewing' },
    { key: 'crosspostedViews', label: 'Cross-posted views', icon: Eye, tone: 'blue', group: 'Video & viewing' },
    { key: 'facebookViews', label: 'Facebook views', icon: Eye, tone: 'blue', group: 'Video & viewing' },
  ].filter(metric =>
    (post.format === 'Story' || !['replies', 'navigation', 'linkClicks'].includes(metric.key)) &&
    (post.format === 'Reel' || !['reelsSkipRate', 'crosspostedViews', 'facebookViews'].includes(metric.key)),
  ) as Metric[];
  // Preserve a supplied zero, and never turn an absent source value into one.
  const supplied = (key: string) => postAvailable(post, key) &&
    typeof extra[key] === 'number' && Number.isFinite(extra[key]);
  const primaryKeys = post.format === 'Story'
    ? ['views', 'reach', 'linkClicks']
    : ['views', supplied('reach') ? 'reach' : supplied('mediaViewers') ? 'mediaViewers' : 'reach'];
  const primary = primaryKeys.map(key => metrics.find(metric => metric.key === key)!).filter(Boolean);
  const remaining = metrics.filter(metric => !primaryKeys.includes(metric.key));
  const unavailable = remaining.filter(metric => !supplied(metric.key));
  const published = recordedDate(post.publishedAt || post.date);
  const observed = recordedDate(post.observedAt);
  const isVideo = post.mediaType === 'video';
  const caption = post.caption || post.title;
  const canExpandCaption = caption.length > 160 || caption.split('\n').length > 4;
  const scope = post.metricScope === 'period' ? 'Reported period' : 'Lifetime results';
  const format = post.format === 'Static' ? 'Photo' : post.format;
  const FormatIcon = isVideo ? Video : post.format === 'Story' ? Play : Image;

  function metricCard(metric: Metric, hero = false) {
    const Icon = metric.icon;
    const available = supplied(metric.key);
    return (
      <article className={`${styles.metric} ${hero ? styles.heroMetric : ''}`}
        data-tone={metric.tone} data-available={available} data-post-metric={metric.key} key={metric.key}>
        <div className={styles.metricLabel}><span className={styles.metricIcon}><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></span><span>{metric.label}</span></div>
        <strong>{available ? number(Number(extra[metric.key])) : '—'}</strong>
        {hero && <small>{available ? metric.key === 'linkClicks' ? 'Taps on this story’s link' : metric.key === 'mediaViewers' ? 'Unique people reported' : scope : 'Not supplied by this source'}</small>}
        {!hero && ['averageWatchTimeMs', 'watchTimeMs'].includes(metric.key) && <small>Milliseconds</small>}
      </article>
    );
  }

  return (
    <Sheet open onOpenChange={value => !value && close()}>
      <SheetContent className={styles.drawer} showCloseButton={false}>
        <SheetHeader className={styles.header}>
          <div className={styles.eyebrow}>YSABEL SOCIETY / CONTENT INTELLIGENCE</div>
          <SheetTitle className={styles.title}>{post.format === 'Story' ? 'Story performance' : 'Post performance'}</SheetTitle>
          <SheetDescription className={styles.description}>The published moment, and the response it received.</SheetDescription>
          <SheetClose className={styles.close} aria-label="Close post preview"><X size={20} aria-hidden="true" /></SheetClose>
          <div className={styles.publication}>
            <span className={styles.platform}><DataIcon name={post.platform} />{post.platform}</span>
            <span className={styles.format}><FormatIcon size={14} aria-hidden="true" />{format}</span>
            <span className={styles.published}><CalendarDays size={14} aria-hidden="true" /><time dateTime={post.publishedAt || post.date}>{published ? published.day : post.date}</time></span>
            <span className={styles.source} data-imported={post.origin === 'file'}><i />{post.origin === 'file' ? 'Imported data' : 'API data'}</span>
          </div>
        </SheetHeader>

        <div className={styles.body}>
          <div className={styles.layout}>
            <section className={styles.preview} aria-label="Published content preview">
              <div className={styles.media}>
                {post.image && failedMedia !== post.image ? isVideo
                  ? <video src={post.image} controls playsInline preload="metadata" onError={() => setFailedMedia(post.image)} aria-label={post.title} />
                  : <img src={post.image} alt={post.title} onError={() => setFailedMedia(post.image)} />
                  : <div className={styles.emptyMedia}><FormatIcon size={30} strokeWidth={1.4} aria-hidden="true" /><strong>Preview unavailable</strong><span>The published results are still shown.</span></div>}
                <span className={styles.mediaBadge}><FormatIcon size={13} aria-hidden="true" />{format}</span>
              </div>
              {post.permalink && <a className={styles.original} href={post.permalink} target="_blank" rel="noreferrer">View on {post.platform}<ArrowUpRight size={17} aria-hidden="true" /></a>}
              <div className={styles.caption}>
                <div className={styles.sectionLabel}>ORIGINAL CAPTION</div>
                <p className={captionExpanded ? '' : styles.captionCompact}>{caption || 'No caption was supplied for this post.'}</p>
                {canExpandCaption && <button className={styles.textButton} aria-expanded={captionExpanded} onClick={() => setCaptionExpanded(value => !value)}>{captionExpanded ? 'Show less' : 'Read full caption'}<ChevronDown size={14} data-expanded={captionExpanded} aria-hidden="true" /></button>}
              </div>
            </section>

            <section className={styles.results} aria-label="Post results">
              <div className={styles.sectionHead}><h3>At a glance</h3><span>{scope}</span></div>
              <div className={styles.heroGrid} data-count={primary.length}>{primary.map(metric => metricCard(metric, true))}</div>
              {(['Interactions', 'Audience & actions', 'Video & viewing'] as const).map(group => {
                const fields = remaining.filter(metric => metric.group === group && supplied(metric.key));
                return fields.length > 0 && <section className={styles.metricGroup} aria-label={group} key={group}><div className={styles.sectionHead}><h3>{group}</h3><span>{fields.length} reported</span></div><div className={styles.metricGrid} data-count={fields.length}>{fields.map(metric => metricCard(metric))}</div></section>;
              })}
              <div className={styles.observed}><Clock3 size={14} aria-hidden="true" /><span>{observed ? `Updated ${observed.day} · ${observed.time}` : 'Recorded at import'}<small>Publication dates filter posts. These are {post.metricScope === 'period' ? 'source-reported period metrics' : 'lifetime totals'}, not daily activity.</small></span></div>
              {unavailable.length > 0 && <details className={styles.details}><summary><span>More metrics <small>{unavailable.length} not supplied</small></span><ChevronDown size={16} aria-hidden="true" /></summary><p className={styles.detailNote}>A dash means this source did not supply the metric. It does not mean zero.</p><div className={styles.unavailableGrid}>{unavailable.map(metric => <div key={metric.key}><metric.icon size={15} aria-hidden="true" /><span>{metric.label}{['averageWatchTimeMs', 'watchTimeMs'].includes(metric.key) ? ' · ms' : ''}</span><strong>—</strong></div>)}</div></details>}
              <details className={styles.details}><summary><span>Data & source details</span><ChevronDown size={16} aria-hidden="true" /></summary><p className={styles.detailNote}>{post.platform} · {post.origin === 'file' ? 'Imported file' : 'Provider API'}{published && post.publishedAt ? ` · Published ${published.day} at ${published.time} (Prishtina time)` : ''}. Manage published content on its original platform.</p>{Object.keys(post.sourceMetrics || {}).length > 0 ? <div className={styles.sourceValues}>{Object.entries(post.sourceMetrics || {}).map(([key, value]) => <div key={key}><strong>{key}</strong><span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span></div>)}</div> : <p className={styles.detailNote}>No additional source definitions were supplied.</p>}</details>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
