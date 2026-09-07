import {
  database,
  identity,
  json,
  apiError,
  requireDate,
} from '@/lib/server/db';
import { parseTikTokStudio } from '@/lib/tiktok-studio';
import { persistImport } from '@/lib/server/report-import';
export async function POST(req: Request) {
  try {
    const owner = (await identity(req)).userId;
    if (Number(req.headers.get('content-length') || 0) > 3500000)
      throw new Error('INPUT:Choose files smaller than 3 MB.');
    const body = (await req.json()) as {
      files: { name: string; csv: string }[];
      range: { start: string; end: string };
    };
    if (
      !Array.isArray(body.files) ||
      body.files.some(
        (f) => !f || typeof f.name !== 'string' || typeof f.csv !== 'string',
      )
    )
      throw new Error('INPUT:Choose TikTok Studio CSV files.');
    const range = {
        start: requireDate(body.range?.start),
        end: requireDate(body.range?.end),
      },
      result = parseTikTokStudio(body.files, range),
      db = database();
    const link = await db
      .prepare(
        "SELECT external_id FROM connector_links WHERE owner=? AND source='tiktok'",
      )
      .bind(owner)
      .first<{ external_id: string }>();
    if (!link)
      throw new Error(
        'INPUT:Connect the Ysabel Society TikTok account before importing its Studio reports.',
      );
    await persistImport(owner, 'tiktok', link.external_id, result, range);
    const now = new Date().toISOString();
    await db
      .prepare(
        'INSERT INTO sync_runs(id,owner,channel,status,started_at,finished_at,message) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        owner,
        'TikTok',
        'Imported file',
        now,
        now,
        `TikTok Studio: ${result.daily.length} daily records and ${result.tables.length} audience/detail reports imported.`,
      )
      .run();
    return json({
      saved: true,
      days: result.daily.length,
      reports: result.tables.length,
    });
  } catch (e) {
    return apiError(e);
  }
}
