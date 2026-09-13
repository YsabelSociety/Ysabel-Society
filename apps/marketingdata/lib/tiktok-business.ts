export const TIKTOK_BUSINESS_CALLBACK = '/api/tiktok-business/callback';

export function businessAuthorizationUrl(
  raw: string,
  callback: string,
  state: string,
) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      'INPUT:Copy the TikTok account holder authorization URL from your Business API app.',
    );
  }
  if (
    url.origin !== 'https://www.tiktok.com' ||
    !/^\/v2\/auth\/authorize\/?$/.test(url.pathname) ||
    url.username ||
    url.password ||
    url.hash ||
    !url.searchParams.get('client_key') ||
    !url.searchParams.get('scope')
  )
    throw new Error(
      'INPUT:Use the official TikTok account holder authorization URL.',
    );
  for (const key of [
    'access_token',
    'refresh_token',
    'client_secret',
    'code',
    'auth_code',
  ])
    if (url.searchParams.has(key))
      throw new Error(
        'INPUT:The authorization URL must not contain credentials or an authorization code.',
      );
  const clientKey = url.searchParams.get('client_key')!,
    scope = url.searchParams.get('scope')!;
  if (
    url.searchParams.getAll('client_key').length !== 1 ||
    url.searchParams.getAll('scope').length !== 1
  )
    throw new Error('INPUT:Use the unmodified authorization URL from TikTok.');
  url.search = new URLSearchParams({ client_key: clientKey, scope }).toString();
  url.searchParams.set('redirect_uri', callback);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('disable_auto_auth', '1');
  url.searchParams.set('state', state);
  return url.toString();
}

export function businessTokenResult(
  result: any,
  clientId: string,
  now = Date.now(),
) {
  const d = result?.data;
  if (
    result?.code !== 0 ||
    !d ||
    typeof d.access_token !== 'string' ||
    !d.access_token ||
    typeof d.refresh_token !== 'string' ||
    !d.refresh_token ||
    typeof d.open_id !== 'string' ||
    !d.open_id ||
    typeof d.scope !== 'string' ||
    !Number.isFinite(d.expires_in) ||
    d.expires_in <= 0 ||
    !Number.isFinite(d.refresh_token_expires_in) ||
    d.refresh_token_expires_in <= 0
  )
    throw new Error(
      'INPUT:TikTok did not issue a complete business authorization. Check app approval and authorize again.',
    );
  return {
    clientId,
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    openId: d.open_id,
    scopes: d.scope,
    expiresAt: now + Math.min(d.expires_in, 86400) * 1000,
    refreshExpiresAt:
      now + Math.min(d.refresh_token_expires_in, 31536000) * 1000,
    authorizedAt: new Date(now).toISOString(),
  };
}
