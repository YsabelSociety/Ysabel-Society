'use client';
import { number, type Daily, type Range } from '@/lib/analytics';
import { activitySeries } from '@/lib/activity-series';
import { GBP_METRICS } from '@/lib/google-business';
import { DataIcon } from './data-icons';
import { MiniHistory } from './mini-history';
import { SourceBadge } from './source-badge';
import styles from './google-business.module.css';
import { ArrowUpRight } from 'lucide-react';
import type { OpenDashboardData } from '@/lib/dashboard-navigation';

export function GoogleDiscoveryCards({
  rows,
  range,
  onOpen,
}: {
  rows: Daily[];
  range: Range;
  onOpen?: OpenDashboardData;
}) {
  const Card = onOpen ? 'button' : 'article';
  const googleRows = rows.filter((row) => row.channel === 'Google Business');
  return (
    <div className="overview-google-discovery" aria-label="Google Search and Maps daily activity">
      {(['search', 'maps'] as const).map((key) => {
        const metric = GBP_METRICS.find((item) => item.key === key)!;
        const points = activitySeries(googleRows, 'Google Business', key);
        const supplied = points.filter((point) => point.value !== null);
        return (
          <Card
            key={key}
            className={styles.metric}
            type={onOpen ? 'button' : undefined}
            onClick={onOpen ? () => onOpen('Google Business', key) : undefined}
            aria-label={onOpen ? 'Open ' + metric.label : metric.label}
            style={{ '--gbp-color': metric.color } as React.CSSProperties}
          >
            <div className={styles.metricHeading}>
              <span className={styles.metricIcon} aria-hidden="true">
                <DataIcon name={key} />
              </span>
              <span>{metric.label}</span>
              {onOpen && <ArrowUpRight className="dashboard-card-arrow" size={16}/>}
            </div>
            <strong>
              {supplied.length
                ? number(supplied.reduce((sum, point) => sum + Number(point.value), 0))
                : '—'}
            </strong>
            <SourceBadge channel="Google Business" metric={key} rows={googleRows} unavailable={!supplied.length} />
            {supplied.length > 0 && (
              <div className="overview-discovery-history"><MiniHistory values={points.map((point) => point.value)} label={`Daily history · ${range.start} – ${range.end}`} /></div>
            )}
            <small>
              {supplied.length ? metric.description : 'No daily report supplied for these dates.'}
            </small>
          </Card>
        );
      })}
    </div>
  );
}
