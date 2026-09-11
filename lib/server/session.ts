import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { APP_BASE } from '@/lib/app-path';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

const settings = () => env as unknown as Record<string, string>;
const db = () => (env as unknown as { DB: D1Database }).DB;
export const SESSION_COOKIE = 'ys_marketing_session';
// Renewed while the app is used; the password is never stored on the device.
export const SESSION_MAX_AGE = 365 * 24 * 60 * 60;
export function cookieValue(cookies: string, name: string) {
  return (
    cookies
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(name + '='))
      ?.slice(name.length + 1) || ''
  );
}
export async function tokenHash(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export function sessionCookie(value: string, age: number, secure = true) {
  const expires = new Date(age > 0 ? Date.now() + age * 1000 : 0).toUTCString();
  return `${SESSION_COOKIE}=${value}; Path=${APP_BASE}; HttpOnly; SameSite=Lax; Max-Age=${age}; Expires=${expires}${secure ? '; Secure' : ''}`;
}
export function verifyOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const configured = settings().CONNECTOR_SITE_URL;
  const allowed = [
    new URL(req.url).origin,
    ...(configured ? [new URL(configured).origin] : []),
  ];
  if (!origin || !allowed.includes(origin)) throw new Error('FORBIDDEN');
}
export async function getSessionUser(): Promise<ChatGPTUser | null> {
  const token = cookieValue(
    (await headers()).get('cookie') || '',
    SESSION_COOKIE,
  );
  if (!/^[a-f0-9]{64}$/.test(token) || !settings().MARKETING_OWNER_ID)
    return null;
  const session = await db()
    .prepare(
      'SELECT owner FROM marketing_sessions WHERE token_hash=? AND expires_at>?',
    )
    .bind(await tokenHash(token), Date.now())
    .first<{ owner: string }>();
  if (!session || session.owner !== settings().MARKETING_OWNER_ID) return null;
  return {
    userId: session.owner,
    displayName: 'Ysabel Society',
    fullName: 'Ysabel Society',
    email: 'info@ysabelsociety.com',
  };
}
export async function newSession() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  await db().batch([
    db()
      .prepare('DELETE FROM marketing_sessions WHERE expires_at<?')
      .bind(Date.now()),
    db()
      .prepare(
        'INSERT INTO marketing_sessions(token_hash,owner,expires_at) VALUES(?,?,?)',
      )
      .bind(
        await tokenHash(token),
        settings().MARKETING_OWNER_ID,
        Date.now() + SESSION_MAX_AGE * 1000,
      ),
  ]);
  return token;
}
export async function renewSession(req: Request) {
  const token = cookieValue(req.headers.get('cookie') || '', SESSION_COOKIE);
  const owner = settings().MARKETING_OWNER_ID;
  if (!/^[a-f0-9]{64}$/.test(token) || !owner) throw new Error('UNAUTHORIZED');
  const now = Date.now();
  // Update only a still-valid session. A revoked or expired login cannot return.
  const renewed = await db()
    .prepare('UPDATE marketing_sessions SET expires_at=? WHERE token_hash=? AND owner=? AND expires_at>? RETURNING owner')
    .bind(now + SESSION_MAX_AGE * 1000, await tokenHash(token), owner, now)
    .first<{ owner: string }>();
  if (!renewed) throw new Error('UNAUTHORIZED');
  return token;
}
export async function revokeSession(req: Request) {
  const token = cookieValue(req.headers.get('cookie') || '', SESSION_COOKIE);
  if (token)
    await db()
      .prepare('DELETE FROM marketing_sessions WHERE token_hash=?')
      .bind(await tokenHash(token))
      .run();
}
