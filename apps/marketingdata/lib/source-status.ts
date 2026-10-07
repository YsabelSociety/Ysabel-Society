import type { Daily } from './analytics';
export type SourceStatus = {
  channel: string;
  status: string;
  lastSync: string | null;
  method?: 'api' | 'file' | null;
  autoSync?: boolean;
};
export type WebsiteRealtime = {
  activeUsers: number | null;
  pageViews: number | null;
  events: number | null;
  observedAt: string;
};

export function sourceFeedLabel(statuses: SourceStatus[], channel?: string) {
  const selected = channel ? statuses.filter(s => s.channel === channel) : statuses;
  const live = selected.some(s => s.method === 'api' && s.autoSync && s.status === 'Connected' && s.lastSync);
  const imported = selected.some(s => s.method === 'file');
  if (live) return imported ? 'LIVE DATA · IMPORTED' : 'LIVE DATA · Automatic sync';
  if (imported) return 'IMPORTED';
  if (selected.some(s => s.method === 'api')) return 'Sync needs attention';
  return 'No connected data yet';
}

export function websiteStatus(status?: SourceStatus, hasDailyData = false) {
  if (!status)
    return {
      title: 'Google Analytics is not connected',
      detail: 'Connect the Ysabel Society property to read website reports.',
    };
  if (status.status === 'Needs Attention')
    return {
      title: 'Google Analytics needs attention',
      detail: status.lastSync
        ? 'The latest refresh failed. Previously imported reports remain available. Open Connections to restore access and sync again.'
        : 'The connection is saved, but Google has not allowed a successful report import. Open Connections to authorize access and sync.',
    };
  if (!status.lastSync)
    return {
      title: 'Website reports have not been verified',
      detail:
        'Account setup alone does not confirm data access. Complete authorization and the first import in Connections.',
    };
  return {
    title: 'Connected to Google Analytics',
    detail: hasDailyData
      ? 'Reports were imported from your selected property. Today’s figures may change as Google processes visits.'
      : 'Google accepted the report request but returned no daily activity for these dates. Recent visits may appear in the separate 30-minute snapshot before daily reports are processed.',
  };
}

export function googleScopes(source: string | null) {
  if (source === 'gbp')
    return ['https://www.googleapis.com/auth/business.manage'];
  if (source === 'both')
    return [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/business.manage',
    ];
  return ['https://www.googleapis.com/auth/analytics.readonly'];
}

// Track a metric's source separately from the account's general API connection.
// A Display API follower refresh must never turn saved Studio profile views live.
export function metricSource(row: import('./analytics').Daily, metric: string): 'file' | 'api' {
  const explicit = (row.sourceMetrics?.metricOrigins as Record<string, unknown> | undefined)?.[metric];
  if (explicit === 'api' || explicit === 'file') return explicit;
  if (row.channel === 'TikTok' && row.sourceMetrics?.studioImport) {
    if (metric === 'followers' && row.sourceMetrics?.followersObservedAt) return 'api';
    return 'file';
  }
  return row.sourceMetrics?.origin === 'file' ? 'file' : 'api';
}

/** A connection check date is separate from the date actually reported by a metric. */
export function suppliedMetricRows(rows: Daily[], metric?: string) {
  return metric ? rows.filter(row => (!row.available || row.available.includes(metric)) &&
    typeof row[metric as keyof Daily] === 'number' && Number.isFinite(row[metric as keyof Daily])) : rows;
}
export function latestMetricDate(rows: Daily[], metric?: string) {
  return suppliedMetricRows(rows, metric).reduce<string | undefined>((latest, row) =>
    !latest || row.date > latest ? row.date : latest, undefined);
}
export function reportingDateLabel(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
