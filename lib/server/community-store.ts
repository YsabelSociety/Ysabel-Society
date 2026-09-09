import { database } from './db';
import { seal, unseal } from './connector-vault';
import { type CommunityRecord, type CommunityStatus } from '@/lib/community';

export async function saveCommunity(owner: string, records: CommunityRecord[]) {
  if (records.length > 2000)
    throw new Error('INPUT:Save at most 2,000 records per batch.');
  for (let i = 0; i < records.length; i += 40) {
    const statements = await Promise.all(
      records.slice(i, i + 40).map(async (record) => {
        const id = record.accountId + ':' + record.id;
        // A successful message import can omit optional profile fields. Retain
        // the last supplied picture instead of erasing it during every sync.
        if (record.kind === 'profile' && record.origin === 'api') {
          const row = await database().prepare('SELECT encrypted FROM community_records WHERE owner=? AND source=? AND kind=? AND id=?')
            .bind(owner,record.source,'profile',id).first<{encrypted:string}>();
          if (row) {
            const old = await unseal<CommunityRecord>(row.encrypted, owner+':community:'+record.source+':profile:'+id);
            record = {...old,...record,avatar:record.avatar || old.avatar,conversationUrl:record.conversationUrl || old.conversationUrl,
              profileUrl:record.profileUrl || old.profileUrl,username:record.username || old.username,
              followers:record.followers ?? old.followers,followersObservedAt:record.followersObservedAt || old.followersObservedAt,
              profileCheckedAt:record.profileCheckedAt || old.profileCheckedAt};
          }
        }
        const encrypted = await seal(
          record,
          owner + ':community:' + record.source + ':' + record.kind + ':' + id,
        );
        return database()
          .prepare(
            'INSERT INTO community_records(owner,source,kind,id,occurred_at,encrypted,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,source,kind,id) DO UPDATE SET occurred_at=excluded.occurred_at,encrypted=excluded.encrypted,updated_at=excluded.updated_at',
          )
          .bind(
            owner,
            record.source,
            record.kind,
            id,
            record.time,
            encrypted,
            new Date().toISOString(),
          );
      }),
    );
    await database().batch(statements);
  }
}
export async function readCommunity(owner: string, kind: string) {
  const kinds =
    kind === 'review'
      ? ['review']
      : kind === 'mention'
        ? ['mention']
        : ['message', 'profile'];
  const r = await database()
    .prepare(
      'SELECT source,kind,id,encrypted FROM community_records WHERE owner=? AND kind IN (' +
        kinds.map(() => '?').join(',') +
        ') ORDER BY occurred_at DESC LIMIT 10001',
    )
    .bind(owner, ...kinds)
    .all<{ source: string; kind: string; id: string; encrypted: string }>();
  const records: CommunityRecord[] = [];
  for (let i = 0; i < Math.min(r.results.length, 10000); i += 100)
    records.push(
      ...(await Promise.all(
        r.results
          .slice(i, Math.min(i + 100, 10000))
          .map((row) =>
            unseal<CommunityRecord>(
              row.encrypted,
              owner +
                ':community:' +
                row.source +
                ':' +
                row.kind +
                ':' +
                row.id,
            ),
          ),
      )),
    );
  const status = await database()
    .prepare(
      'SELECT source,kind,state,detail,updated_at AS syncedAt,cursor,account_id AS accountId,total FROM community_sync WHERE owner=?',
    )
    .bind(owner)
    .all<CommunityStatus>();
  return {
    records,
    statuses: status.results.map(({ cursor, ...s }) => {
      const interrupted =
        s.kind !== 'review' &&
        s.state === 'syncing' &&
        !!s.syncedAt &&
        Date.parse(s.syncedAt) < Date.now() - 120000;
      return {
        ...s,
        ...(interrupted
          ? {
              state: 'needs-attention',
              detail:
                'The last import was interrupted. Saved records and history progress are retained. Sync again or load older records to continue.',
            }
          : {}),
        more: !!cursor,
      };
    }),
    truncated: r.results.length > 10000,
  };
}
export async function readGoogleReview(
  owner: string,
  accountId: string,
  id: string,
) {
  const key = accountId + ':' + id;
  const row = await database()
    .prepare(
      "SELECT encrypted FROM community_records WHERE owner=? AND source='gbp' AND kind='review' AND id=?",
    )
    .bind(owner, key)
    .first<{ encrypted: string }>();
  return row
    ? unseal<CommunityRecord>(
        row.encrypted,
        owner + ':community:gbp:review:' + key,
      )
    : null;
}
export async function saveCommunityStatus(
  owner: string,
  status: CommunityStatus,
) {
  await database()
    .prepare(
      'INSERT INTO community_sync(owner,source,kind,state,detail,updated_at,cursor,account_id,total) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,source,kind) DO UPDATE SET state=excluded.state,detail=excluded.detail,updated_at=excluded.updated_at,cursor=CASE WHEN ? THEN excluded.cursor WHEN ? AND excluded.account_id IS NOT community_sync.account_id THEN NULL ELSE community_sync.cursor END,account_id=CASE WHEN ? THEN excluded.account_id ELSE community_sync.account_id END,total=CASE WHEN ? THEN excluded.total ELSE community_sync.total END',
    )
    .bind(
      owner,
      status.source,
      status.kind,
      status.state,
      status.detail,
      new Date().toISOString(),
      status.cursor || null,
      status.accountId || null,
      status.total ?? null,
      status.cursor !== undefined ? 1 : 0,
      status.accountId !== undefined ? 1 : 0,
      status.accountId !== undefined ? 1 : 0,
      status.total !== undefined ? 1 : 0,
    )
    .run();
}
