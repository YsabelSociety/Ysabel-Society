import { database, files, identity, apiError, json } from '@/lib/server/db';
export async function POST(req: Request) {
  try {
    const user = await identity(req);
    if (Number(req.headers.get('content-length') ?? 0) > 26 * 1024 * 1024)
      throw new Error('INPUT:Files must be under 25 MB.');
    const form = await req.formData(),
      file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size > 25 * 1024 * 1024 ||
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/webm',
      ].includes(file.type)
    )
      throw new Error(
        'INPUT:Choose a JPG, PNG, WebP, MP4 or WebM under 25 MB.',
      );
    const id = crypto.randomUUID(),
      key = user.userId + '/' + id;
    await files().put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    await database()
      .prepare(
        'INSERT INTO media_assets(id,owner,object_key,name,mime_type,size) VALUES(?,?,?,?,?,?)',
      )
      .bind(id, user.userId, key, file.name.slice(0, 200), file.type, file.size)
      .run();
    return json({
      id,
      url: '/marketingdata/api/media/' + id,
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
    });
  } catch (e) {
    return apiError(e);
  }
}
