import { database } from './db';
import { syncLinkedSource } from './connector-sync';
import { runCommunitySync } from './community-sync';
import { SOURCE_CHANNELS } from '@/lib/connector-catalog';
import { recentSyncWindow } from '@/lib/sync-window';
import type { CommunitySource } from '@/lib/community';
import type { RefreshJob, RefreshTask } from '@/lib/refresh-types';

type Row = {
  id: string;
  origin: string;
  status: RefreshJob['status'];
  payload: string;
  created_at: string;
  updated_at: string;
  lease_until: number;
};
type Payload = { tasks: RefreshTask[]; timezone: string };
function view(row: Row): RefreshJob {
  const { tasks } = JSON.parse(row.payload) as Payload;
  return {
    id: row.id,
    origin: row.origin,
    status: row.status,
    tasks,
    updatedAt: row.updated_at,
    completed: tasks.filter((t) => t.state !== 'pending').length,
    current: tasks.find((t) => t.state === 'pending')?.label,
    retryAfter: row.lease_until > Date.now() ? 3 : undefined,
  };
}
async function read(owner: string) {
  return database()
    .prepare('SELECT * FROM refresh_jobs WHERE owner=?')
    .bind(owner)
    .first<Row>();
}
export async function readRefresh(owner: string) {
  const row = await read(owner);
  return row ? view(row) : null;
}
export async function startRefresh(
  owner: string,
  origin: 'manual' | 'automatic' | 'scheduled',
  force = false,
) {
  const existing = await read(owner);
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 45 * 60000).toISOString();
  if (
    existing &&
    ((existing.status === 'running' && existing.updated_at > stale) ||
      (!force &&
        existing.updated_at > new Date(Date.now() - 300000).toISOString()))
  )
    return view(existing);
  const settings = await database()
    .prepare('SELECT payload FROM workspace_settings WHERE owner=?')
    .bind(owner)
    .first<{ payload: string }>();
  let timezone = 'Europe/Tirane';
  try {
    timezone = JSON.parse(settings?.payload || '{}').timezone || timezone;
  } catch {
    /* Default workspace timezone. */
  }
  const links = await database()
    .prepare(
      "SELECT l.source,l.provider,l.auto_sync FROM connector_links l JOIN platform_accounts a ON a.id=l.owner||':'||l.source||':'||l.external_id WHERE l.owner=? AND a.enabled=1 ORDER BY l.source",
    )
    .bind(owner)
    .all<{ source: string; provider: string; auto_sync: number }>();
  const tasks: RefreshTask[] = [];
  for (const link of links.results) {
    const label = SOURCE_CHANNELS[link.source] || link.source;
    const manual = link.provider === 'file';
    const paused = origin !== 'manual' && !link.auto_sync;
    tasks.push({
      source: link.source,
      kind: 'reports',
      label: label + ' reports',
      pages: 0,
      state: manual || paused ? 'manual' : 'pending',
      detail: manual
        ? 'Upload a new export; this connection does not currently have online report access.'
        : paused
          ? 'Automatic import is paused in Connections.'
          : undefined,
    });
    if (manual || paused) continue;
    if (['instagram', 'facebook', 'tiktok'].includes(link.source)) {
      for (const kind of ['message', 'mention'] as const)
        tasks.push({
          source: link.source,
          kind,
          label: label + (kind === 'message' ? ' messages' : ' mentions'),
          state: 'pending',
          pages: 0,
        });
    } else if (link.source === 'gbp')
      tasks.push({
        source: link.source,
        kind: 'review',
        label: 'Google Business reviews',
        state: 'pending',
        pages: 0,
      });
  }
  // One durable run per owner; another browser/scheduler joins it instead of duplicating imports.
  await database()
    .prepare(
      "INSERT INTO refresh_jobs(owner,id,origin,status,payload,created_at,updated_at,lease_until) VALUES(?,?,?,'running',?,?,?,0) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,origin=excluded.origin,status='running',payload=excluded.payload,created_at=excluded.created_at,updated_at=excluded.updated_at,lease=NULL,lease_until=0 WHERE refresh_jobs.status<>'running' OR refresh_jobs.updated_at<?",
    )
    .bind(
      owner,
      crypto.randomUUID(),
      origin,
      JSON.stringify({ tasks, timezone }),
      now,
      now,
      stale,
    )
    .run();
  return view((await read(owner))!);
}

export async function stepRefresh(owner: string, id: string) {
  const row = await read(owner);
  if (!row || row.id !== id)
    throw new Error(
      'INPUT:This import has finished or been replaced. Start a new sync.',
    );
  if (row.status !== 'running') return view(row);
  const lease = crypto.randomUUID();
  const claimed = await database()
    .prepare(
      "UPDATE refresh_jobs SET lease=?,lease_until=? WHERE owner=? AND id=? AND status='running' AND lease_until<? AND payload=?",
    )
    .bind(lease, Date.now() + 120000, owner, id, Date.now(), row.payload)
    .run();
  if (!claimed.meta.changes)
    return { ...view((await read(owner))!), retryAfter: 3 };
  const payload = JSON.parse(row.payload) as Payload;
  const task = payload.tasks.find((t) => t.state === 'pending');
  if (task) {
    try {
      // Recheck the selected account immediately before importing. Never revive a disconnected source.
      const linked = await database()
        .prepare(
          "SELECT l.provider,l.auto_sync FROM connector_links l JOIN platform_accounts a ON a.id=l.owner||':'||l.source||':'||l.external_id WHERE l.owner=? AND l.source=? AND a.enabled=1",
        )
        .bind(owner, task.source)
        .first<{ provider: string; auto_sync: number }>();
      if (
        !linked ||
        linked.provider === 'file' ||
        (row.origin !== 'manual' && !linked.auto_sync)
      ) {
        task.state = 'manual';
        task.detail =
          'Connection is disconnected, uses an export, or automatic import is paused.';
      } else if (task.kind === 'reports') {
        const result = await syncLinkedSource(
          owner,
          task.source,
          recentSyncWindow(payload.timezone),
        );
        task.state = result.skipped
          ? 'partial'
          : result.snapshot?.partial
            ? 'partial'
            : 'updated';
        task.detail = result.skipped
          ? 'A source import is already running. Its saved results will appear when it finishes.'
          : result.snapshot?.partial
            ? 'Available reports imported. Some provider metrics are unavailable; check coverage in Connections.'
            : 'Latest available reports imported; previously saved history retained.';
      } else {
        const result = await runCommunitySync(
          owner,
          task.source as CommunitySource,
          task.pages > 0,
          true,
          task.kind === 'mention' ? 'mention' : undefined,
          true,
        );
        task.pages++;
        task.detail =
          result.detail ||
          (result.needsAttention
            ? 'The provider could not supply this data. Check access in Connections.'
            : result.skipped
              ? 'Another import is in progress.'
              : 'Accessible records imported; provider history and permissions still apply.');
        task.state = result.needsAttention
          ? 'attention'
          : result.skipped
            ? 'partial'
            : result.more
              ? task.pages >= 20
                ? 'partial'
                : 'pending'
              : 'updated';
        if (result.more && task.pages >= 20)
          task.detail =
            'Recent records updated. Older pages remain saved for continuation from Inbox or Mentions.';
      }
    } catch (e) {
      task.state = 'attention';
      // Only deliberately public adapter errors can reach the dashboard; never leak tokens or raw provider payloads.
      task.detail =
        e instanceof Error && e.message.startsWith('INPUT:')
          ? e.message.slice(6, 806)
          : 'The provider could not complete this import. Saved data is retained; other sources will continue.';
    }
    if (task.state === 'pending') {
      payload.tasks.splice(payload.tasks.indexOf(task), 1);
      payload.tasks.push(task); // Give every platform a turn before draining older pages.
    }
  }
  const status = payload.tasks.some((t) => t.state === 'pending')
    ? 'running'
    : payload.tasks.some((t) => t.state !== 'updated')
      ? 'partial'
      : 'complete';
  await database()
    .prepare(
      'UPDATE refresh_jobs SET payload=?,status=?,updated_at=?,lease=NULL,lease_until=0 WHERE owner=? AND id=? AND lease=?',
    )
    .bind(
      JSON.stringify(payload),
      status,
      new Date().toISOString(),
      owner,
      id,
      lease,
    )
    .run();
  return view((await read(owner))!);
}
