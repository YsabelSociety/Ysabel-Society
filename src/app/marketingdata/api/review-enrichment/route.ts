import { saveReviewPhotos } from '../../../../lib/review-enrichment';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const json = (body: unknown, status=200) => Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'Invalid request origin.'},403);
  const cookie = (request.headers.get('cookie') || '').split(';').map(v=>v.trim()).filter(v=>v.startsWith('ys_marketing_session=')).join('; ');
  if (!cookie) return json({error:'Sign in first.'},401);
  try {
    const auth = await fetch('https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/community?kind=review',{
      headers:{cookie},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),
    });
    if (!auth.ok || !auth.headers.get('content-type')?.includes('application/json')) return json({error:'Your review session could not be verified.'},401);
    const saved = await auth.json();
    if (!Array.isArray(saved.records)) return json({error:'Reviews are not available.'},503);
    const raw = await request.text();
    if (raw.length > 1500000) return json({error:'The snapshot is too large.'},413);
    const body = JSON.parse(raw);
    const count = await saveReviewPhotos(body.reviews,saved.records);
    return json({photos:count});
  } catch (error) {
    return json({error:error instanceof Error ? error.message : 'Photo import failed.'},400);
  }
}
