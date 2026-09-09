import { database, requireText } from './db';
import { digest, randomToken, readVault, writeVault } from './connector-vault';
import { getApp, siteOrigin, type AppCredentials } from './connector-oauth';
import { connectInstagramMessaging } from './instagram-messaging';
import { APP_BASE } from '@/lib/app-path';

const provider = 'instagram-login';
export async function instagramLoginSettings(owner: string) {
  const app = await readVault<AppCredentials>(owner, 'app', provider);
  return { loginReady: !!app?.clientId && !!app.clientSecret, clientId: app?.clientId || '' };
}
export async function saveInstagramLogin(owner: string, input: any) {
  const clientId = requireText(input.clientId, 40), clientSecret = requireText(input.clientSecret, 200), apiVersion = requireText(input.apiVersion, 12);
  if (!/^\d+$/.test(clientId) || !/^v\d{1,2}\.\d{1,2}$/.test(apiVersion)) throw new Error('INPUT:Check the Instagram app ID and API version.');
  await writeVault(owner, 'app', provider, { clientId, clientSecret, apiVersion });
  return { loginReady: true };
}
export function instagramLoginCookie(value: string, secure: boolean, clear = false) {
  return `ys_instagram_login=${value}; HttpOnly; SameSite=Lax; Path=${APP_BASE}/api/instagram-messaging; Max-Age=${clear ? 0 : 600}${secure ? '; Secure' : ''}`;
}
export async function beginInstagramLogin(owner: string, req: Request) {
  const app = await getApp(owner, provider), state = randomToken(), nonce = randomToken();
  const redirect = siteOrigin(req) + '/api/instagram-messaging/callback';
  await database().prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(Date.now()).run();
  await database().prepare('INSERT INTO oauth_states(state_hash,owner,provider,nonce_hash,verifier,redirect_uri,expires_at) VALUES(?,?,?,?,?,?,?)')
    .bind(await digest(state), owner, provider, await digest(nonce), '', redirect, Date.now()+600000).run();
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.search = new URLSearchParams({ client_id: app.clientId, redirect_uri: redirect, response_type: 'code', scope: 'instagram_business_basic,instagram_business_manage_messages', enable_fb_login: '0', force_authentication: '1', state }).toString();
  return { url: url.href, cookie: instagramLoginCookie(nonce, new URL(req.url).protocol === 'https:') };
}
async function exchange(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const body: any = await response.json();
  // Never return provider URLs, codes, tokens or secrets in a browser error.
  if (!response.ok || body.error || !body.access_token) throw new Error('INPUT:Instagram did not complete authorization. Check the Instagram app credentials, redirect URL and messaging permission, then try again.');
  return body;
}
export async function finishInstagramLogin(owner: string, req: Request) {
  const q = new URL(req.url).searchParams, state = q.get('state'), code = q.get('code');
  const nonce = (req.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('ys_instagram_login='))?.split('=')[1];
  if (!state || !nonce) throw new Error('INPUT:Instagram sign-in expired. Start again.');
  const record = await database().prepare('DELETE FROM oauth_states WHERE state_hash=? AND owner=? AND provider=? AND nonce_hash=? AND expires_at>? RETURNING redirect_uri')
    .bind(await digest(state), owner, provider, await digest(nonce), Date.now()).first<{redirect_uri:string}>();
  if (!record || !code || q.has('error')) throw new Error('INPUT:Instagram sign-in was cancelled or expired.');
  const app = await getApp(owner, provider);
  const short = await exchange('https://api.instagram.com/oauth/access_token', {method:'POST', body:new URLSearchParams({client_id:app.clientId,client_secret:app.clientSecret,grant_type:'authorization_code',redirect_uri:record.redirect_uri,code})});
  const long = await exchange('https://graph.instagram.com/access_token?' + new URLSearchParams({grant_type:'ig_exchange_token',client_secret:app.clientSecret,access_token:short.access_token}));
  return connectInstagramMessaging(owner, {accessToken:long.access_token,apiVersion:app.apiVersion}, {
    expiresAt: Date.now()+Number(long.expires_in || 3600)*1000,
    refreshedAt: Date.now(),
  });
}
