import { getStore } from '@netlify/blobs';
import { readAnalyses } from './review-ai';

type Review = { profileUrl?: string; source?: string; kind?: string; text?: string; [key: string]: unknown };
type Photo = { url: string; caption: string };
type Entry = { photos: Photo[]; capturedAt: string };
const store = () => getStore({name: 'ysabel-review-enrichment', consistency: 'strong'});
const profile = (r: Review) => r.profileUrl?.match(/\/contrib\/(\d+)/)?.[1];
export function validReviewPhotos(input: unknown): Photo[] {
  if (!Array.isArray(input) || input.length > 50) throw new Error('Include at most 50 photos per review.');
  const result: Photo[] = [];
  for (const p of input) {
    const u = new URL(p.url);
    if (u.protocol !== 'https:' || u.username || u.password || !/(^|\.)googleusercontent\.com$/.test(u.hostname)) throw new Error('Review photos must use their original Google image URL.');
    if (!result.some(v => v.url === u.href)) result.push({url:u.href, caption:String(p.caption || '').slice(0,300)});
  }
  return result;
}
export async function enrichReviews(records: Review[]) {
  try {
    const data = await Promise.race([
      store().get('photos', {type:'json'}),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
    ]);
    const withPhotos = records.map(r => {
      const item = data?.[profile(r) || ''];
      return item && r.source === 'gbp' && r.kind === 'review' ? {...r, reviewPhotos:item.photos} : r;
    });
    try { return await Promise.race([readAnalyses(withPhotos),new Promise<typeof withPhotos>(resolve=>setTimeout(()=>resolve(withPhotos),2000))]); }
    catch { return withPhotos; }
  } catch { return records; }
}
export async function saveReviewPhotos(input: unknown, records: Review[]) {
  if (!Array.isArray(input) || input.length > 2000) throw new Error('Invalid review photo snapshot.');
  const known = new Set(records.filter(r=>r.source==='gbp'&&r.kind==='review').map(profile));
  const updates: Record<string,Entry> = {};
  for (const r of input) {
    if (!known.has(r.profileId)) throw new Error('Import the matching review before its photos.');
    const photos = validReviewPhotos(r.photos);
    if (photos.length) updates[r.profileId] = {photos,capturedAt:new Date().toISOString()};
  }
  // Compare-and-swap prevents overlapping imports from losing each other's photos.
  const s = store();
  for (let attempt=0;attempt<3;attempt++) {
    const previous = await s.getWithMetadata('photos',{type:'json'});
    const next = {...previous?.data, ...updates};
    const result = await s.setJSON('photos',next,previous ? {onlyIfMatch:previous.etag} : {onlyIfNew:true});
    if (result.modified) return Object.values(updates).reduce((n,r)=>n+r.photos.length,0);
  }
  throw new Error('Another photo import is running. Retry this snapshot.');
}
