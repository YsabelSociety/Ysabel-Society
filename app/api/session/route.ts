import { database, secrets, apiError, json } from '@/lib/server/db';
import { passwordHash, constantEqual } from '@/lib/password';
import {
  newSession,
  revokeSession,
  sessionCookie,
  tokenHash,
  verifyOrigin,
} from '@/lib/server/session';
export async function POST(req: Request) {
  try {
    verifyOrigin(req);
    if (Number(req.headers.get('content-length') || 0) > 4096)
      return Response.json(
        { error: 'Use the sign-in form to continue.' },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
    const config = secrets();
    if (
      !config.MARKETING_PASSWORD_HASH ||
      !config.MARKETING_PASSWORD_SALT ||
      !config.MARKETING_OWNER_ID
    )
      throw new Error('UNCONFIGURED');
    const window = Math.floor(Date.now() / 900000);
    const ip = await tokenHash(
      req.headers.get('cf-connecting-ip') || 'unknown',
    );
    const counts = await database().batch([
      database()
        .prepare('DELETE FROM marketing_login_limits WHERE window<?')
        .bind(window - 1),
      database()
        .prepare(
          'INSERT INTO marketing_login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts=attempts+1 RETURNING attempts',
        )
        .bind(ip, window),
      database()
        .prepare(
          'INSERT INTO marketing_login_limits(key,window,attempts) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET attempts=attempts+1 RETURNING attempts',
        )
        .bind('global', window),
    ]);
    if (
      Number((counts[1].results[0] as any)?.attempts) > 12 ||
      Number((counts[2].results[0] as any)?.attempts) > 120
    )
      return Response.json(
        { error: 'Too many attempts. Please try again in 15 minutes.' },
        {
          status: 429,
          headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' },
        },
      );
    const body = (await req.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const password =
      typeof body.password === 'string' && body.password.length <= 1024
        ? body.password
        : '';
    const valid = constantEqual(
      await passwordHash(password, config.MARKETING_PASSWORD_SALT),
      config.MARKETING_PASSWORD_HASH,
    );
    if (!valid || body.username !== config.MARKETING_USERNAME)
      return Response.json(
        { error: 'The username or password is incorrect.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    const token = await newSession();
    await database()
      .prepare('DELETE FROM marketing_login_limits WHERE key=? AND window=?')
      .bind(ip, window)
      .run();
    return Response.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': sessionCookie(
            token,
            86400,
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
    verifyOrigin(req);
    await revokeSession(req);
    return Response.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': sessionCookie(
            '',
            0,
            new URL(req.url).protocol === 'https:',
          ),
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
