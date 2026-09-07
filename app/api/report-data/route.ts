import {
  identity,
  database,
  json,
  apiError,
  requireDate,
} from '@/lib/server/db';
import { unseal } from '@/lib/server/connector-vault';
import type { CommunityRecord } from '@/lib/community';

// Keyset pagination keeps PDF exports independent of the dashboard's display limits.
export async function GET(req: Request) {
  try {
    const owner = (await identity()).userId;
    const q = new URL(req.url).searchParams;
    const dataset = q.get('dataset');
    if (dataset !== 'posts' && dataset !== 'community')
      throw new Error('INPUT:Unknown report dataset.');
    const cursor = q.get('cursor') ? JSON.parse(q.get('cursor')!) : [];
    if (
      !Array.isArray(cursor) ||
      (cursor.length && cursor.length !== (dataset === 'posts' ? 2 : 3)) ||
      cursor.some((v) => typeof v !== 'string' || v.length > 1000)
    )
      throw new Error('INPUT:Invalid report cursor.');
    const db = database();
    if (dataset === 'posts') {
      const start = requireDate(q.get('start')),
        end = requireDate(q.get('end'));
      if (start > end) throw new Error('INPUT:Invalid date range.');
      const result = await db
        .prepare(
          'SELECT p.account_id,p.post_id,p.payload FROM source_posts p JOIN platform_accounts a ON a.id=p.account_id WHERE a.owner=? AND a.enabled=1 AND p.published_date>=? AND p.published_date<=?' +
            (cursor.length ? ' AND (p.account_id,p.post_id)>(?,?)' : '') +
            ' ORDER BY p.account_id,p.post_id LIMIT 251',
        )
        .bind(owner, start, end, ...cursor)
        .all<{ account_id: string; post_id: string; payload: string }>();
      const page = result.results.slice(0, 250),
        last = page.at(-1);
      return json({
        records: page.map((r) => JSON.parse(r.payload)),
        nextCursor:
          result.results.length > 250 && last
            ? JSON.stringify([last.account_id, last.post_id])
            : null,
      });
    }
    const result = await db
      .prepare(
        'SELECT source,kind,id,encrypted FROM community_records WHERE owner=?' +
          (cursor.length ? ' AND (source,kind,id)>(?,?,?)' : '') +
          ' ORDER BY source,kind,id LIMIT 251',
      )
      .bind(owner, ...cursor)
      .all<{ source: string; kind: string; id: string; encrypted: string }>();
    const page = result.results.slice(0, 250),
      records: CommunityRecord[] = [];
    for (let i = 0; i < page.length; i += 25)
      records.push(
        ...(await Promise.all(
          page
            .slice(i, i + 25)
            .map((r) =>
              unseal<CommunityRecord>(
                r.encrypted,
                owner + ':community:' + r.source + ':' + r.kind + ':' + r.id,
              ),
            ),
        )),
      );
    const statuses = cursor.length
      ? []
      : (
          await db
            .prepare(
              'SELECT source,kind,state,detail,updated_at AS syncedAt FROM community_sync WHERE owner=?',
            )
            .bind(owner)
            .all()
        ).results;
    const last = page.at(-1);
    return json({
      records,
      statuses,
      nextCursor:
        result.results.length > 250 && last
          ? JSON.stringify([last.source, last.kind, last.id])
          : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
