import type { CommunityRecord } from './community';

type CapturedReview = {
  profileId: string; name: string; profileUrl: string; avatar?: string;
  rating: number; timeLabel: string; reviewUrl?: string; text: string; details?: string;
};
const columns = ['id', 'time', 'time_precision', 'time_label', 'name', 'rating', 'text', 'reply', 'avatar', 'profile_url', 'review_url'];
const quote = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
function approximateTime(label: string, capturedAt: string) {
  const date = new Date(capturedAt);
  const value = label.toLowerCase().trim();
  if (value === 'yesterday') date.setUTCDate(date.getUTCDate() - 1);
  else if (!['today', 'just now'].includes(value)) {
    const match = value.match(/^(\d+|a|an)\s+(minute|hour|day|week|month|year)s?\s+ago$/);
    if (!match) throw new Error('A review has an unsupported date label: ' + label);
    const n = /^\d+$/.test(match[1]) ? Number(match[1]) : 1;
    if (match[2] === 'month') date.setUTCMonth(date.getUTCMonth() - n);
    else if (match[2] === 'year') date.setUTCFullYear(date.getUTCFullYear() - n);
    else date.setTime(date.getTime() - n * ({minute:60000,hour:3600000,day:86400000,week:604800000}[match[2]] || 0));
  }
  return date.toISOString();
}
export function prepareGoogleOwnerReviews(raw: string, existing: CommunityRecord[]) {
  const capture = JSON.parse(raw);
  if (capture.businessId !== '2654256529003455405') throw new Error('This snapshot must belong to Ysabel Society.');
  if (!Number.isFinite(Date.parse(capture.capturedAt))) throw new Error('The capture date is missing.');
  if (!Array.isArray(capture.reviews) || !capture.reviews.length || capture.reviews.length > 2000) throw new Error('Include 1–2,000 captured reviews.');
  const saved = existing.filter(r => r.source === 'gbp' && r.kind === 'review');
  const byProfile = new Map(saved.map(r => [r.profileUrl?.match(/contrib\/(\d+)/)?.[1], r]));
  const seen = new Set<string>();
  let added = 0, updated = 0, skipped = 0, unchanged = 0;
  const rows: string[][] = [];
  for (const r of capture.reviews as CapturedReview[]) {
    if (!/^\d{15,25}$/.test(r.profileId) || seen.has(r.profileId)) throw new Error('Missing or duplicate Google reviewer identifier.');
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5 || typeof r.text !== 'string') throw new Error('A review has invalid content or rating.');
    if (!r.profileUrl?.startsWith('https://www.google.com/maps/contrib/' + r.profileId + '/')) throw new Error('A reviewer link does not match its identifier.');
    seen.add(r.profileId);
    const old = byProfile.get(r.profileId);
    // Never create a file duplicate of a review already owned by the API feed.
    if (old && old.accountId !== 'file') { skipped++; continue; }
    const details = (r.details || '').replace(/(\d\/5)(?=[A-Za-z])/g, '$1 · ');
    const comment = r.text.trim() || old?.text || '';
    const text = details && !comment.includes(details) ? [comment, details].filter(Boolean).join('\n\n') : comment;
    if (old && old.rating === r.rating && old.text === text &&
      (old.name || '') === (r.name || old.name || '') &&
      (old.avatar || '') === (r.avatar || old.avatar || '') &&
      (old.profileUrl || '') === r.profileUrl &&
      (old.reviewUrl || '') === (r.reviewUrl || old.reviewUrl || '')) {
      unchanged++; continue;
    }
    old ? updated++ : added++;
    rows.push([old?.id || 'gbp-profile-' + r.profileId,
      old?.time || approximateTime(r.timeLabel, capture.capturedAt),
      old ? old.timePrecision || '' : 'relative', old?.timeLabel || r.timeLabel,
      r.name || old?.name || '', String(r.rating), text, old?.reply || '',
      r.avatar || old?.avatar || '', r.profileUrl, r.reviewUrl || old?.reviewUrl || '']);
  }
  const batches = [];
  for (let i = 0; i < rows.length; i += 40) batches.push([columns, ...rows.slice(i, i + 40)].map(row => row.map(quote).join(',')).join('\n'));
  return { batches, added, updated, skipped, unchanged, captured: seen.size,
    retained: saved.filter(r => !seen.has(r.profileUrl?.match(/contrib\/(\d+)/)?.[1] || '')).length };
}
