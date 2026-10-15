import { createRequestCache } from './request-cache';

type Row = Record<string, any>;
const reads = createRequestCache<Row>();
const cacheable = new Set(['overview','audience','segments','segment-counts','profile','reservations','feedback','insights','guestlists','imports','consent-summary']);
function key(query: string) { const params = new URLSearchParams(query); params.sort(); return params.toString(); }
export const peekSevenRooms = (query: string) => reads.peek(key(query));
export const invalidateSevenRooms = () => reads.invalidate();
if (typeof window !== 'undefined') window.addEventListener('ysabel:sevenrooms-updated', invalidateSevenRooms);

async function request(q: string | Row) {
  const retry = typeof q === 'string' || ['process','stage','part','finish'].includes(q.op);
  for (let attempt = 0; attempt < (retry ? 3 : 1); attempt++) {
    try {
      const response = await fetch(typeof q === 'string' ? '/marketingdata/api/sevenrooms?' + q : '/marketingdata/api/sevenrooms',
        typeof q === 'string' ? { cache: 'no-store', signal: AbortSignal.timeout(25000) }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q), signal: AbortSignal.timeout(45000) });
      const data = await response.json().catch(() => ({ error: 'The service is temporarily unavailable. Please retry.' }));
      if (!response.ok) {
        if (response.status === 401) reads.clear();
        throw Object.assign(new Error(data.error || 'Please try again.'), { noRetry: response.status < 500 && response.status !== 429 });
      }
      return data as Row;
    } catch (error) {
      if (!retry || attempt === 2 || (error as { noRetry?: boolean }).noRetry) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw new Error('Please retry.');
}

export async function sevenRoomsApi(q: string | Row): Promise<Row> {
  if (typeof q === 'string') {
    const normalized = key(q);
    return cacheable.has(new URLSearchParams(q).get('op') || 'overview')
      ? reads.read(normalized, () => request(q)) : request(q);
  }
  const data = await request(q);
  if (!['begin','part','stage','process','analyzed'].includes(q.op)) reads.invalidate();
  return data;
}
