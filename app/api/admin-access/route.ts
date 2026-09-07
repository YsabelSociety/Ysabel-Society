import { database, identity, json, apiError, secrets } from '@/lib/server/db';
import {
  adminExpires,
  adminSubject,
  adminCookie,
} from '@/lib/server/admin-access';
import { createAdminGrant } from '@/lib/admin-grant';
import { passwordHash, constantEqual } from '@/lib/password';
export async function GET(req: Request) {
  try {
    await identity();
    const expiresAt = await adminExpires(req);
    return json({ unlocked: !!expiresAt, expiresAt });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await identity(req);
    const subject = await adminSubject(req);
    if (!subject) throw new Error('UNAUTHORIZED');
    const config = secrets();
    if (
      !config.MARKETING_ADMIN_PIN_HASH ||
      !config.MARKETING_ADMIN_PIN_SALT ||
      !config.MARKETING_ADMIN_SIGNING_KEY
    )
      throw new Error('INPUT:Administrator access is not configured.');
    const raw = await req.text();
    if (raw.length > 128) throw new Error('INPUT:Enter your six-digit PIN.');
    const window = Math.floor(Date.now() / 900000);
    const db = database();
    const attempts = await db.batch([
      db
        .prepare('DELETE FROM marketing_login_limits WHERE window<?')
        .bind(window - 1),
      db
        .prepare(
          'INSERT INTO marketing_login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts=attempts+1 RETURNING attempts',
        )
        .bind('admin:' + subject, window),
      db
        .prepare(
          'INSERT INTO marketing_login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts=attempts+1 RETURNING attempts',
        )
        .bind('admin:global', window),
    ]);
    if (
      Number((attempts[1].results[0] as any)?.attempts) > 5 ||
      Number((attempts[2].results[0] as any)?.attempts) > 50
    )
      return Response.json(
        { error: 'Too many PIN attempts. Try again in 15 minutes.' },
        {
          status: 429,
          headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' },
        },
      );
    let body: { pin?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error('INPUT:Enter your six-digit PIN.');
    }
    const pin =
      typeof body?.pin === 'string' && /^\d{6}$/.test(body.pin) ? body.pin : '';
    const valid = constantEqual(
      await passwordHash(pin, config.MARKETING_ADMIN_PIN_SALT),
      config.MARKETING_ADMIN_PIN_HASH,
    );
    if (!pin || !valid)
      return Response.json(
        { error: 'The PIN is incorrect.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    const grant = await createAdminGrant(
      subject,
      config.MARKETING_ADMIN_SIGNING_KEY,
    );
    await db
      .prepare('DELETE FROM marketing_login_limits WHERE key=? AND window=?')
      .bind('admin:' + subject, window)
      .run();
    return Response.json(
      { unlocked: true, expiresAt: grant.expiresAt },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': adminCookie(
            grant.value,
            new URL(req.url).protocol === 'https:',
          ),
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    await identity(req);
    return Response.json(
      { unlocked: false },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': adminCookie(
            '',
            new URL(req.url).protocol === 'https:',
            true,
          ),
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
