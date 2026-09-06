import {
  database,
  identity,
  apiError,
  json,
  requireText,
  requireDate,
} from '@/lib/server/db';
import { POSTS, CHANNELS, UNITS, BRAND_NAME, type Post } from '@/lib/analytics';
export async function GET() {
  try {
    const user = await identity();
    const db = database(),
      owner = user.userId;
    await db.batch(
      POSTS.map((p) =>
        db
          .prepare(
            'INSERT OR IGNORE INTO content_items(owner,id,payload,position,updated_at) VALUES(?,?,?,?,?)',
          )
          .bind(
            owner,
            p.id,
            JSON.stringify(p),
            p.position,
            new Date().toISOString(),
          ),
      ),
    );
    const [content, notes, reports, settings] = await Promise.all([
      db
        .prepare(
          'SELECT payload,position FROM content_items WHERE owner=? ORDER BY position',
        )
        .bind(owner)
        .all(),
      db
        .prepare('SELECT * FROM annotations WHERE owner=? ORDER BY date')
        .bind(owner)
        .all(),
      db
        .prepare(
          'SELECT payload FROM reports WHERE owner=? ORDER BY created_at DESC',
        )
        .bind(owner)
        .all(),
      db
        .prepare('SELECT payload FROM workspace_settings WHERE owner=?')
        .bind(owner)
        .first<{ payload: string }>(),
    ]);
    return json({
      posts: content.results
        .map((r: any) => ({
          ...JSON.parse(r.payload, (_, value) => typeof value === 'string' && /^\/(api|media)\//.test(value) ? '/marketingdata' + value : value),
          unit: BRAND_NAME,
          position: r.position,
        }))
        .filter((p: Post) => p.status !== 'Deleted'),
      annotations: notes.results.map((n: any) => ({ ...n, unit: BRAND_NAME })),
      reports: reports.results.map((r: any) => ({
        ...JSON.parse(r.payload),
        unit: BRAND_NAME,
      })),
      settings: {
        timezone: 'Europe/Tirane',
        ...(settings ? JSON.parse(settings.payload) : {}),
        units: UNITS,
        workspace: BRAND_NAME,
      },
      user: { name: user.displayName, email: user.email },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await identity(req),
      owner = user.userId;
    const body = (await req.json()) as any;
    const db = database(),
      now = new Date().toISOString();
    const op = body.op;
    if (op === 'savePost') {
      const input = body.post;
      const id = requireText(input.id, 80);
      const old = await db
        .prepare('SELECT payload FROM content_items WHERE owner=? AND id=?')
        .bind(owner, id)
        .first<{ payload: string }>();
      const prior = old ? (JSON.parse(old.payload) as Post) : undefined;
      if (
        !CHANNELS.includes(input.platform) ||
        !['Draft', 'Approved', 'Scheduled', 'Published', 'Archived'].includes(
          input.status,
        )
      )
        throw new Error('INPUT:Choose a valid platform and status.');
      if (input.status === 'Published' && prior?.status !== 'Published')
        throw new Error(
          'INPUT:Publishing requires a verified platform publication. Use Scheduled for planning.',
        );
      const image = String(input.image ?? '');
      if (!/^\/(media\/\d+\.jpg|api\/media\/[a-zA-Z0-9-]+)$/.test(image))
        throw new Error('INPUT:Upload a supported image or video.');
      if (
        input.status === 'Scheduled' &&
        (!input.scheduled || Number.isNaN(Date.parse(input.scheduled)))
      )
        throw new Error('INPUT:Choose a schedule date and time.');
      const p: Post = {
        ...(prior ?? {
          views: 0,
          reach: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
          followers: 0,
          visits: 0,
          score: 0,
          date: now.slice(0, 10),
          position: Date.now(),
        }),
        id,
        title: requireText(input.title, 160),
        caption:
          typeof input.caption === 'string' ? input.caption.slice(0, 5000) : '',
        image,
        platform: input.platform,
        format: requireText(input.format, 40),
        unit: BRAND_NAME,
        status: input.status,
        tags: Array.isArray(input.tags)
          ? input.tags.slice(0, 12).map((t: unknown) => requireText(t, 40))
          : [],
        campaign:
          typeof input.campaign === 'string'
            ? input.campaign.slice(0, 100)
            : '',
        distribution: ['Organic', 'Paid'].includes(input.distribution)
          ? input.distribution
          : 'Organic',
        scheduled:
          typeof input.scheduled === 'string'
            ? input.scheduled.slice(0, 30)
            : '',
        mediaType: input.mediaType === 'video' ? 'video' : 'image',
      };
      await db
        .prepare(
          'INSERT INTO content_items(owner,id,payload,position,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
        )
        .bind(owner, id, JSON.stringify(p), p.position, now)
        .run();
      return json({ post: p });
    }
    if (op === 'deletePost') {
      const id = requireText(body.id, 80);
      const r = await db
        .prepare('SELECT payload FROM content_items WHERE owner=? AND id=?')
        .bind(owner, id)
        .first<{ payload: string }>();
      if (r) {
        const p = { ...JSON.parse(r.payload), status: 'Deleted' };
        await db
          .prepare(
            'UPDATE content_items SET payload=?,updated_at=? WHERE owner=? AND id=?',
          )
          .bind(JSON.stringify(p), now, owner, id)
          .run();
      }
      return json({ ok: true });
    }
    if (op === 'reorder') {
      if (
        !Array.isArray(body.ids) ||
        body.ids.length > 500 ||
        new Set(body.ids).size !== body.ids.length
      )
        throw new Error('INPUT:Invalid content order.');
      await db.batch(
        body.ids.map((id: unknown, i: number) =>
          db
            .prepare(
              'UPDATE content_items SET position=?,updated_at=? WHERE owner=? AND id=?',
            )
            .bind(i, now, owner, requireText(id, 80)),
        ),
      );
      return json({ ok: true });
    }
    if (op === 'annotation') {
      const note = {
        id: crypto.randomUUID(),
        date: requireDate(body.date),
        text: requireText(body.text, 300),
        unit: BRAND_NAME,
      };
      await db
        .prepare(
          'INSERT INTO annotations(owner,id,date,text,unit) VALUES(?,?,?,?,?)',
        )
        .bind(owner, note.id, note.date, note.text, note.unit)
        .run();
      return json({ annotation: note });
    }
    if (op === 'saveReport') {
      const hasSource = await db
        .prepare(
          'SELECT id FROM platform_accounts WHERE owner=? AND enabled=1 LIMIT 1',
        )
        .bind(owner)
        .first();
      const r = {
        id: crypto.randomUUID(),
        title: requireText(body.title, 160),
        start: requireDate(body.start),
        end: requireDate(body.end),
        unit: BRAND_NAME,
        createdAt: now,
        mode: hasSource ? 'live' : 'Demo Data',
      };
      if (r.start > r.end)
        throw new Error('INPUT:Start date must be before end date.');
      await db
        .prepare(
          'INSERT INTO reports(owner,id,payload,created_at) VALUES(?,?,?,?)',
        )
        .bind(owner, r.id, JSON.stringify(r), now)
        .run();
      return json({ report: r });
    }
    if (op === 'settings') {
      const s = {
        workspace: BRAND_NAME,
        timezone: requireText(body.settings.timezone, 100),
        units: UNITS,
      };
      try {
        Intl.DateTimeFormat('en', { timeZone: s.timezone });
      } catch {
        throw new Error('INPUT:Enter a valid time zone.');
      }
      await db
        .prepare(
          'INSERT INTO workspace_settings(owner,payload) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload',
        )
        .bind(owner, JSON.stringify(s))
        .run();
      return json({ settings: s });
    }
    throw new Error('INPUT:Unknown workspace action.');
  } catch (e) {
    return apiError(e);
  }
}
