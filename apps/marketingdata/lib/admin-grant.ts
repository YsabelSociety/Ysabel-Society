import { constantEqual } from './password';
export const ADMIN_COOKIE = 'ys_marketing_admin';
export const ADMIN_AGE = 1800;
async function signature(subject: string, expires: number, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode('ysabel-admin:v1:' + subject + ':' + expires),
    ),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function createAdminGrant(
  subject: string,
  secret: string,
  now = Date.now(),
) {
  const expires = now + ADMIN_AGE * 1000;
  return {
    value: expires + '.' + (await signature(subject, expires, secret)),
    expiresAt: expires,
  };
}
export async function verifyAdminGrant(
  value: string,
  subject: string,
  secret: string,
  now = Date.now(),
) {
  if (!secret || !subject || !/^\d{13}\.[a-f0-9]{64}$/.test(value)) return null;
  const [time, supplied] = value.split('.');
  const expires = Number(time);
  if (expires <= now || expires > now + ADMIN_AGE * 1000) return null;
  return constantEqual(supplied, await signature(subject, expires, secret))
    ? expires
    : null;
}
