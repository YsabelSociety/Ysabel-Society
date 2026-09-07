import { database, requireText } from './db';
import { digest, randomToken, readVault, writeVault } from './connector-vault';
import { siteOrigin } from './connector-oauth';
import { APP_BASE } from '@/lib/app-path';
import {
  businessAuthorizationUrl,
  businessTokenResult,
  TIKTOK_BUSINESS_CALLBACK,
} from '@/lib/tiktok-business';

const PROVIDER = 'tiktok-business';
type BusinessApp = {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
};
type BusinessGrant = ReturnType<typeof businessTokenResult>;
const fingerprint = (app: BusinessApp) => digest(JSON.stringify(app));
export function businessCookie(value: string, req: Request, clear = false) {
  return `ys_oauth_tiktok_business=${value}; HttpOnly; SameSite=Lax; Path=${APP_BASE}/api/tiktok-business; Max-Age=${clear ? 0 : 600}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function businessConnectionStatus(owner: string, req: Request) {
  const app = await readVault<BusinessApp>(owner, 'app', PROVIDER);
  const grant = await readVault<BusinessGrant>(owner, 'grant', PROVIDER);
  const matched = grant && app?.clientId === grant.clientId;
  return {
    configured: !!app,
    clientId: app?.clientId || '',
    authorized: !!matched && grant.refreshExpiresAt > Date.now(),
    authorizedAt: matched ? grant.authorizedAt : null,
    callbackUrl: siteOrigin(req) + TIKTOK_BUSINESS_CALLBACK,
  };
}
export async function saveBusinessApp(owner: string, body: any, req: Request) {
  const clientId = requireText(body.clientId, 40);
  if (!/^\d{5,30}$/.test(clientId))
    throw new Error(
      'INPUT:Enter the numeric app ID from TikTok API for Business.',
    );
  const clientSecret = requireText(body.clientSecret, 1000);
  const authorizationUrl = requireText(body.authorizationUrl, 6000);
  const normalized = businessAuthorizationUrl(
    authorizationUrl,
    siteOrigin(req) + TIKTOK_BUSINESS_CALLBACK,
    'configuration',
  );
  const url = new URL(normalized);
  url.searchParams.delete('state');
  await writeVault(owner, 'app', PROVIDER, {
    clientId,
    clientSecret,
    authorizationUrl: url.toString(),
  } satisfies BusinessApp);
  return businessConnectionStatus(owner, req);
}
async function businessApp(owner: string) {
  const app = await readVault<BusinessApp>(owner, 'app', PROVIDER);
  if (!app)
    throw new Error(
      'INPUT:Save the approved TikTok Business app settings first.',
    );
  return app;
}
export async function startBusinessAuthorization(owner: string, req: Request) {
  const app = await businessApp(owner),
    state = randomToken(),
    nonce = randomToken();
  const redirect = siteOrigin(req) + TIKTOK_BUSINESS_CALLBACK;
  const url = businessAuthorizationUrl(app.authorizationUrl, redirect, state);
  await database()
    .prepare('DELETE FROM oauth_states WHERE expires_at<?')
    .bind(Date.now())
    .run();
  await database()
    .prepare(
      'INSERT INTO oauth_states(state_hash,owner,provider,nonce_hash,verifier,redirect_uri,expires_at) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(
      await digest(state),
      owner,
      PROVIDER,
      await digest(nonce),
      await fingerprint(app),
      redirect,
      Date.now() + 600000,
    )
    .run();
  return { url, cookie: businessCookie(nonce, req) };
}
async function tokenExchange(
  app: BusinessApp,
  body: Record<string, string>,
  refresh = false,
) {
  const response = await fetch(
    'https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/' +
      (refresh ? 'refresh_token/' : 'token/'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        ...body,
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      'INPUT:TikTok could not authorize the business account. Check approval and try again.',
    );
  return businessTokenResult(await response.json(), app.clientId);
}
export async function finishBusinessAuthorization(owner: string, req: Request) {
  const q = new URL(req.url).searchParams;
  const state = q.get('state'),
    code = q.get('code') || q.get('auth_code');
  const nonce = (req.headers.get('cookie') || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('ys_oauth_tiktok_business='))
    ?.split('=')[1];
  if (!state || state.length > 200 || !nonce || nonce.length > 200)
    throw new Error(
      'INPUT:Authorization expired. Start again from your dashboard.',
    );
  const record = await database()
    .prepare(
      'DELETE FROM oauth_states WHERE state_hash=? AND owner=? AND provider=? AND nonce_hash=? AND expires_at>? RETURNING verifier,redirect_uri',
    )
    .bind(await digest(state), owner, PROVIDER, await digest(nonce), Date.now())
    .first<{ verifier: string; redirect_uri: string }>();
  if (!record || !code || code.length > 8000 || q.has('error'))
    throw new Error('INPUT:Authorization was cancelled or expired.');
  const app = await businessApp(owner);
  if (record.verifier !== (await fingerprint(app)))
    throw new Error(
      'INPUT:Connection settings changed. Start authorization again.',
    );
  const grant = await tokenExchange(app, {
    grant_type: 'authorization_code',
    auth_code: code,
    redirect_uri: record.redirect_uri,
  });
  await writeVault(owner, 'grant', PROVIDER, grant);
}
export async function accessBusinessGrant(owner: string) {
  const app = await businessApp(owner);
  let grant = await readVault<BusinessGrant>(owner, 'grant', PROVIDER);
  if (
    !grant ||
    grant.clientId !== app.clientId ||
    grant.refreshExpiresAt <= Date.now()
  )
    throw new Error('INPUT:Authorize your TikTok Business account again.');
  if (grant.expiresAt <= Date.now() + 90000) {
    const next = await tokenExchange(
      app,
      { grant_type: 'refresh_token', refresh_token: grant.refreshToken },
      true,
    );
    if (next.openId !== grant.openId)
      throw new Error(
        'INPUT:TikTok returned a different account. Authorize again.',
      );
    grant = { ...next, authorizedAt: grant.authorizedAt };
    await writeVault(owner, 'grant', PROVIDER, grant);
  }
  return grant;
}
