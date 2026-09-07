import { headers } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_AGE, verifyAdminGrant } from '@/lib/admin-grant';
import { APP_BASE } from '@/lib/app-path';
import { identity, secrets } from './db';
import { cookieValue, SESSION_COOKIE, tokenHash } from './session';

export async function adminSubject(req?: Request) {
  const cookie = (req?.headers || (await headers())).get('cookie') || '';
  const session = cookieValue(cookie, SESSION_COOKIE);
  return /^[a-f0-9]{64}$/.test(session) ? tokenHash(session) : '';
}
export async function adminExpires(req?: Request) {
  const cookie = (req?.headers || (await headers())).get('cookie') || '';
  return verifyAdminGrant(
    cookieValue(cookie, ADMIN_COOKIE),
    await adminSubject(req),
    secrets().MARKETING_ADMIN_SIGNING_KEY || '',
  );
}
export async function requireAdmin(req?: Request) {
  const user = await identity(req);
  if (!(await adminExpires(req))) throw new Error('ADMIN_PIN_REQUIRED');
  return user;
}
export function adminCookie(value: string, secure: boolean, clear = false) {
  return `${ADMIN_COOKIE}=${value}; Path=${APP_BASE}; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : ADMIN_AGE}${secure ? '; Secure' : ''}`;
}
