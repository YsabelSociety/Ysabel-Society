'use client';
import { createContext, useContext } from 'react';
import { metricSource, suppliedMetricRows, latestMetricDate, reportingDateLabel, type SourceStatus } from '@/lib/source-status';
import type { Daily } from '@/lib/analytics';

export const SourceStatusContext = createContext<SourceStatus[]>([]);
export function SourceBadge({channel, rows, imported = false, metric, unavailable = false}: {channel: string; rows?: Daily[]; imported?: boolean; metric?: string; unavailable?: boolean}) {
  const statuses = useContext(SourceStatusContext);
  if (channel === 'All') return null;
  const status = statuses.find(s => s.channel === channel);
  // A follower-only observation must not relabel historical video/profile views.
  const supplied = suppliedMetricRows(rows || [], metric);
  const feeds = metric ? supplied.map(r => metricSource(r, metric)) : [];
  const mixed = feeds.includes('file') && feeds.includes('api');
  const files = imported || (feeds.length ? feeds.every(f => f === 'file') : status?.method === 'file' || (!!supplied.length && supplied.every(r => r.sourceMetrics?.origin === 'file')));
  const live = !files && status?.method === 'api' && status.autoSync && status.status === 'Connected' && !!status.lastSync;
  const studio = channel === 'TikTok' && (files || mixed) && !unavailable;
  const studioRows = supplied.filter(row => metric ? metricSource(row, metric) === 'file' : row.sourceMetrics?.studioImport || row.sourceMetrics?.origin === 'file');
  const latest = latestMetricDate(studioRows, metric);
  const label = unavailable ? 'NOT SUPPLIED' : studio ? mixed ? 'LIVE DATA · STUDIO' : 'LIVE · WITHOUT API' : mixed ? live ? 'LIVE DATA · IMPORTED' : 'SAVED DATA · IMPORTED' : files ? 'IMPORTED' : live ? 'LIVE DATA' : status?.method === 'api' && status.lastSync ? 'SYNC PAUSED' : 'NOT CONNECTED';
  if (!status && !files) return null;
  const title = unavailable ? 'This metric has no supplied data for the selected dates; account connection status is shown separately.' : studio && mixed ? `API observations with saved TikTok Studio records${latest ? ' through ' + reportingDateLabel(latest) : ''}. Studio daily metrics update when a new export is captured.` : studio ? `TikTok Studio snapshot${latest ? '. Reported through ' + reportingDateLabel(latest) : ''}. Studio metrics update when a new export is captured; they are not an automatic API feed.` : mixed ? 'This metric combines API activity and saved file imports on different dates.' : files ? 'Saved imported data; historical imports are not a live feed.' : live ? `Automatic API sync. Provider processing delays apply. Last synced ${new Date(status!.lastSync!).toLocaleString()}.` : 'Automatic API access is not currently verified.';
  const badge = <span className="source-feed-badge" data-feed={unavailable ? 'paused' : studio ? 'studio' : files ? 'file' : live ? 'live' : 'paused'} title={title}><i aria-hidden="true" />{label}</span>;
  return studio ? <span className="source-feed-attribution">{badge}<small className="source-observation">TikTok Studio · {latest ? 'through ' + reportingDateLabel(latest) : 'saved snapshot'}</small></span> : badge;
}
