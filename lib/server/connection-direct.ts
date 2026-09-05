import { SOURCE_CHANNELS } from '@/lib/connector-catalog';
import { type ReportingContext } from './report-google';
import { readVault, writeVault } from './connector-vault';
import { requireText } from './db';
import { requestJSON } from './providers';
export type DirectCredentials = ReportingContext & {
  method: 'token' | 'service-account';
  label: string;
  expiresAt?: number;
  clientEmail?: string;
  privateKey?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
};
const b64 = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
export function parseDirect(input: Record<string, unknown>): DirectCredentials {
  const source = requireText(input.source, 30);
  if (!SOURCE_CHANNELS[source])
    throw new Error('INPUT:Choose a supported source.');
  const method =
    input.method === 'service-account' ? 'service-account' : 'token';
  const c: DirectCredentials = {
    method,
    externalId: requireText(input.externalId, 200),
    label: requireText(input.label, 200),
    accessToken:
      method === 'token' ? requireText(input.accessToken, 12000) : '',
  };
  if (!/^[A-Za-z0-9_.:-]+$/.test(c.externalId))
    throw new Error(
      'INPUT:Use the account identifier from the provider, without a URL.',
    );
  for (const key of [
    'apiVersion',
    'developerToken',
    'loginCustomerId',
    'menuPath',
    'reservationEvent',
    'completedReservationEvent',
    'refreshToken',
    'clientId',
    'clientSecret',
  ] as const)
    if (input[key])
      c[key] = requireText(input[key], key === 'refreshToken' ? 12000 : 2000);
  if (
    ['instagram', 'facebook', 'meta-ads'].includes(source) &&
    !/^v\d{1,2}\.\d{1,2}$/.test(c.apiVersion || '')
  )
    throw new Error('INPUT:Enter your Meta Graph API version.');
  if (input.expiresAt) {
    const time = Date.parse(String(input.expiresAt));
    if (!Number.isFinite(time) || time <= Date.now())
      throw new Error('INPUT:Choose a future expiry date.');
    c.expiresAt = time;
  }
  if (method === 'service-account') {
    if (!['ga4', 'google-ads'].includes(source))
      throw new Error(
        'INPUT:Service accounts are supported for Google Analytics and Google Ads.',
      );
    let data: any;
    try {
      data = JSON.parse(requireText(input.serviceAccount, 20000));
    } catch {
      throw new Error('INPUT:Choose a valid Google service-account JSON key.');
    }
    if (
      data.type !== 'service_account' ||
      !String(data.client_email).endsWith('.gserviceaccount.com') ||
      !String(data.private_key).includes('BEGIN PRIVATE KEY')
    )
      throw new Error('INPUT:This is not a Google service-account JSON key.');
    c.clientEmail = data.client_email;
    c.privateKey = data.private_key;
  }
  return c;
}
export async function directContext(
  source: string,
  credentials: DirectCredentials,
): Promise<ReportingContext> {
  let accessToken = credentials.accessToken;
  if (credentials.method === 'service-account') {
    const scope =
        source === 'google-ads'
          ? 'https://www.googleapis.com/auth/adwords'
          : 'https://www.googleapis.com/auth/analytics.readonly',
      now = Math.floor(Date.now() / 1000);
    const header = b64(
        new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
      ),
      body = b64(
        new TextEncoder().encode(
          JSON.stringify({
            iss: credentials.clientEmail,
            scope,
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
          }),
        ),
      );
    const encoded = credentials.privateKey!.replace(
      /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
      '',
    );
    const key = await crypto.subtle.importKey(
      'pkcs8',
      Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(header + '.' + body),
    );
    const r = await requestJSON('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: header + '.' + body + '.' + b64(new Uint8Array(signature)),
      }),
    });
    if (!r.access_token)
      throw new Error('INPUT:Google could not authorize the service account.');
    accessToken = r.access_token;
  } else if (credentials.expiresAt && credentials.expiresAt < Date.now())
    throw new Error(
      'INPUT:This access token expired. Replace it or connect using provider sign-in.',
    );
  return { ...credentials, accessToken };
}
export const readDirect = (owner: string, source: string) =>
  readVault<DirectCredentials>(owner, 'direct', source);
export const saveDirect = (
  owner: string,
  source: string,
  c: DirectCredentials,
) => writeVault(owner, 'direct', source, c);
