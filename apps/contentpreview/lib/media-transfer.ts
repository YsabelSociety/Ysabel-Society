export type UploadTask = { id: string; name: string; phase: 'preparing' | 'uploading' | 'uploaded' | 'failed'; error?: string; assetId?: string };
export async function mediaRequestError(response: Response, action: string): Promise<Error> {
  if (response.status === 401 || response.status === 403) return new Error('Your session expired. Sign in again before retrying.');
  if (response.status === 413) return new Error('This file is too large for the upload connection. Choose a smaller export and try again.');
  if (response.status === 415) return new Error('This file format is not supported. Export as JPG, PNG, WebP or MP4.');
  if (response.status >= 500) return new Error(`${action} could not finish on the server (HTTP ${response.status}). Your current draft has been kept.`);
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.error === 'string' ? body.error.slice(0, 180) : `${action} failed (HTTP ${response.status}). Please retry.`);
}
type MediaReference = { id: string; slides?: string[]; url?: string };
export function validatePublishMedia(positions: (string | null)[], assets: MediaReference[], serverIds?: Set<string>) {
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  const referenced = new Set<string>();
  const unfinished = new Set<number>();
  const missing = new Set<number>();
  positions.forEach((id, index) => {
    const visited = new Set<string>();
    const queue = id ? [id] : [];
    while (queue.length) {
      const next = queue.shift()!;
      if (visited.has(next)) continue;
      visited.add(next); referenced.add(next);
      const asset = byId.get(next);
      if (next.startsWith('local-') || asset?.url?.startsWith('blob:')) unfinished.add(index + 1);
      else if (!asset || (serverIds && !serverIds.has(next))) missing.add(index + 1);
      for (const slide of asset?.slides || []) queue.push(slide);
    }
  });
  const labels = (items: Set<number>) => [...items].map(n => String(n).padStart(2, '0')).join(', ');
  if (unfinished.size) throw new Error(`Post ${labels(unfinished)} contains media that is not uploaded yet. Open Media and retry the failed upload, or replace it before publishing.`);
  if (missing.size) throw new Error(`Post ${labels(missing)} references media no longer on the server. Replace that image or remove the missing slide before publishing.`);
  return referenced;
}
