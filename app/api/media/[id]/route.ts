import { database, files, identity, apiError } from '@/lib/server/db';
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await identity();
    const { id } = await params;
    const asset = await database()
      .prepare(
        'SELECT object_key,mime_type FROM media_assets WHERE owner=? AND id=?',
      )
      .bind(user.userId, id)
      .first<{ object_key: string; mime_type: string }>();
    if (!asset) return new Response('Not found', { status: 404 });
    const object = await files().get(asset.object_key, { range: req.headers });
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'Content-Type': asset.mime_type,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    });
    if (
      req.headers.has('range') &&
      object.range &&
      'offset' in object.range &&
      typeof object.range.offset === 'number' &&
      typeof object.range.length === 'number'
    ) {
      headers.set(
        'Content-Range',
        'bytes ' +
          object.range.offset +
          '-' +
          (object.range.offset + object.range.length - 1) +
          '/' +
          object.size,
      );
      headers.set('Content-Length', String(object.range.length));
      return new Response(object.body, { status: 206, headers });
    }
    return new Response(object.body, { headers });
  } catch (e) {
    return apiError(e);
  }
}

