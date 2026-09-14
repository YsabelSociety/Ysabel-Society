'use client';
import { createContext, useContext } from 'react';
import type { SourceStatus } from '@/lib/source-status';
import type { Daily } from '@/lib/analytics';

export const SourceStatusContext = createContext<SourceStatus[]>([]);
export function SourceBadge({channel, rows, imported = false}: {channel: string; rows?: Daily[]; imported?: boolean}) {
  const statuses = useContext(SourceStatusContext);
  if (channel === 'All') return null;
  const status = statuses.find(s => s.channel === channel);
  const files = imported || status?.method === 'file' || (!!rows?.length && rows.every(r => r.sourceMetrics?.origin === 'file'));
  const live = !files && status?.method === 'api' && status.autoSync && status.status === 'Connected' && !!status.lastSync;
  const label = files ? 'IMPORTED' : live ? 'LIVE DATA' : status?.method === 'api' && status.lastSync ? 'SYNC PAUSED' : 'NOT CONNECTED';
  if (!status && !files) return null;
  return <span className="source-feed-badge" data-feed={files ? 'file' : live ? 'live' : 'paused'} title={files ? 'Saved imported data; historical imports are not a live feed.' : live ? `Automatic API sync. Provider processing delays apply. Last synced ${new Date(status!.lastSync!).toLocaleString()}.` : 'Automatic API access is not currently verified.'}><i aria-hidden="true" />{label}</span>;
}
