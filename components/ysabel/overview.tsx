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
import { MediaCards } from './content';
import { ProfileViews, ChannelTimeline } from './activity-panels';
import { DataIcon } from './data-icons';
export default function Overview({
  rows,
  range,
  previous,
  setPage,
  posts,
  onSelect,
  onMetric,
  live = false,
}: {
  rows: Daily[];
  range: Range;
  previous: Daily[];
  setPage: (p: string) => void;
  posts: Post[];
  onSelect: (p: Post) => void;
  onMetric: (key: string) => void;
  live?: boolean;
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
  return (
    <>
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
      <div className="overview-intelligence">
        <section className="intelligence surface">
          <div className="section-head">
            <h2>
              <Sparkles size={16} /> Digital Intelligence
            </h2>
            <span className="pill">{live ? 'LIVE' : 'PREVIEW'}</span>
          </div>
          <p className="intelligence-intro">The story behind the numbers.</p>
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
          <button className="text-link" onClick={() => setPage('Insights')}>
            Open intelligence <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
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
