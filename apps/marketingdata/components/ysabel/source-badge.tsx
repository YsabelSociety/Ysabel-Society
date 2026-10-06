'use client';
import { createContext, useContext } from 'react';
import { metricSource, type SourceStatus } from '@/lib/source-status';
import type { Daily } from '@/lib/analytics';

export const SourceStatusContext = createContext<SourceStatus[]>([]);
export function SourceBadge({channel, rows, imported = false, metric, unavailable = false}: {channel: string; rows?: Daily[]; imported?: boolean; metric?: string; unavailable?: boolean}) {
  const statuses = useContext(SourceStatusContext);
  if (channel === 'All') return null;
  const status = statuses.find(s => s.channel === channel);
  const feeds = metric ? rows?.map(r => metricSource(r, metric)) || [] : [];
  const mixed = feeds.includes('file') && feeds.includes('api');
  const files = imported || (feeds.length ? feeds.every(f => f === 'file') : status?.method === 'file' || (!!rows?.length && rows.every(r => r.sourceMetrics?.origin === 'file')));
  const live = !files && status?.method === 'api' && status.autoSync && status.status === 'Connected' && !!status.lastSync;
  const label = unavailable ? 'NOT SUPPLIED' : mixed ? live ? 'LIVE DATA · IMPORTED' : 'SAVED DATA · IMPORTED' : files ? 'IMPORTED' : live ? 'LIVE DATA' : status?.method === 'api' && status.lastSync ? 'SYNC PAUSED' : 'NOT CONNECTED';
  if (!status && !files) return null;
  return <span className="source-feed-badge" data-feed={unavailable ? 'paused' : files ? 'file' : live ? 'live' : 'paused'} title={unavailable ? 'This metric has no supplied data for the selected dates; account connection status is shown separately.' : mixed ? 'This metric combines API activity and saved file imports on different dates.' : files ? 'Saved imported data; historical imports are not a live feed.' : live ? `Automatic API sync. Provider processing delays apply. Last synced ${new Date(status!.lastSync!).toLocaleString()}.` : 'Automatic API access is not currently verified.'}><i aria-hidden="true" />{label}</span>;
}
