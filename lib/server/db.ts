import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { verifyOrigin } from './session';
export const database = () => (env as unknown as { DB: D1Database }).DB;
export const files = () => (env as unknown as { FILES: R2Bucket }).FILES;
export const secrets = () => env as unknown as Record<string, string>;
export async function identity(req?: Request) {
  const user = await getChatGPTUser();
  if (!user) throw new Error('UNAUTHORIZED');
  if (req && req.method !== 'GET') {
    verifyOrigin(req);
  }
  return user;
}
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const status =
    message === 'UNAUTHORIZED'
      ? 401
      : message === 'FORBIDDEN' || message === 'ADMIN_PIN_REQUIRED'
        ? 403
        : message.startsWith('INPUT:')
          ? 400
          : 503;
  return Response.json(
    {
      error:
        message === 'ADMIN_PIN_REQUIRED'
          ? 'Enter the administrator PIN to continue.'
          : status === 400
            ? message.slice(6)
            : status === 401
              ? 'Sign in to continue.'
              : status === 403
                ? 'This request could not be verified.'
                : 'The workspace could not save this change. Please try again.',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export const json = (value: unknown) =>
  Response.json(value, { headers: { 'Cache-Control': 'private, no-store' } });
export const requireText = (x: unknown, max = 200) => {
  if (typeof x !== 'string' || !x.trim() || x.length > max)
    throw new Error('INPUT:Please enter valid text.');
  return x.trim();
};
export const requireDate = (x: unknown) => {
  if (
    typeof x !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
    Number.isNaN(Date.parse(x))
  )
    throw new Error('INPUT:Choose a valid date.');
  return x;
};
