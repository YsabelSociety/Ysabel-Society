export function allowedReviewPhoto(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === '443') &&
      /^lh\d+\.googleusercontent\.com$/.test(u.hostname)
    );
  } catch {
    return false;
  }
}
export async function fetchReviewPhoto(
  url: string,
  fetcher: typeof fetch = fetch,
) {
  if (!allowedReviewPhoto(url)) return null;
  const response = await fetcher(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  });
  const type = (response.headers.get('content-type') || '').split(';')[0];
  const max = 512 * 1024;
  if (
    !response.ok ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(type) ||
    Number(response.headers.get('content-length') || 0) > max ||
    !response.body
  ) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes, type };
}
