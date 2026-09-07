import {
  connectorGroup,
  type ConnectorProvider,
} from '@/lib/connector-catalog';
import { database, secrets } from './db';
import { digest, randomToken, readVault, writeVault } from './connector-vault';
import { requestJSON } from './providers';
import { googleScopes } from '@/lib/source-status';
import { APP_BASE } from '@/lib/app-path';
import { verifiedMetaExpiry } from '@/lib/meta-token-status';
export type AppCredentials = {
  clientId: string;
  clientSecret: string;
  apiVersion?: string;
  configId?: string;
};
export type Resource = {
  source: string;
  id: string;
  label: string;
  pageToken?: string;
};
export type Grant = {
  scopes?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  openId?: string;
  resources?: Resource[];
  authorizedAt: string;
};
export function siteOrigin(req: Request) {
  const url = new URL(secrets().CONNECTOR_SITE_URL || req.url);
  return url.origin + APP_BASE;
}
export async function getApp(owner: string, provider: string) {
  const app = await readVault<AppCredentials>(owner, 'app', provider);
  if (!app?.clientId || !app.clientSecret)
    throw new Error(
      'INPUT:Complete the first-time app setup before connecting.',
    );
  return app;
}
async function metaExpiry(app: AppCredentials, token: string) {
  const result = await requestJSON(
    `https://graph.facebook.com/${app.apiVersion}/debug_token?input_token=${encodeURIComponent(token)}`,
    {
      headers: {
        Authorization: 'Bearer ' + app.clientId + '|' + app.clientSecret,
      },
    },
  );
  return verifiedMetaExpiry(result.data || {}, app.clientId);
}
async function tokenRequest(
  provider: ConnectorProvider,
  app: AppCredentials,
  body: Record<string, string>,
) {
  const endpoint =
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : provider === 'tiktok'
        ? 'https://open.tiktokapis.com/v2/oauth/token/'
        : `https://graph.facebook.com/${app.apiVersion}/oauth/access_token`;
  const result = await requestJSON(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      [provider === 'tiktok' ? 'client_key' : 'client_id']: app.clientId,
      client_secret: app.clientSecret,
      ...body,
    }),
  });
  if (!result.access_token || result.error)
    throw new Error(
      'INPUT:Authorization was not completed. Check the app settings and permissions.',
    );
  return result;
}
export async function beginOAuth(
  owner: string,
  provider: ConnectorProvider,
  req: Request,
) {
  const group = connectorGroup(provider),
    app = await getApp(owner, provider),
    state = randomToken(),
    nonce = randomToken(),
    verifier = randomToken();
  const redirectUri = siteOrigin(req) + '/api/oauth/' + provider + '/callback';
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
      provider,
      await digest(nonce),
      verifier,
      redirectUri,
      Date.now() + 600000,
    )
    .run();
  const endpoint =
    provider === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : provider === 'meta'
        ? `https://www.facebook.com/${app.apiVersion}/dialog/oauth`
        : 'https://www.tiktok.com/v2/auth/authorize/';
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    [provider === 'tiktok' ? 'client_key' : 'client_id']: app.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope:
      provider === 'google'
        ? googleScopes(new URL(req.url).searchParams.get('source')).join(' ')
        : group.scopes.join(','),
    state,
  }).toString();
  if (provider === 'meta') {
    url.searchParams.delete('scope');
    url.searchParams.set('config_id', app.configId!);
    url.searchParams.set('override_default_response_type', 'true');
  }
  if (provider === 'google') {
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('code_challenge', await digest(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return {
    url: url.toString(),
    cookie: `ys_oauth_${provider}=${nonce}; HttpOnly; SameSite=Lax; Path=${APP_BASE}/api/oauth/${provider}; Max-Age=600${secure}`,
  };
}
export async function finishOAuth(
  owner: string,
  provider: ConnectorProvider,
  req: Request,
) {
  const q = new URL(req.url).searchParams,
    state = q.get('state'),
    code = q.get('code');
  const nonce = (req.headers.get('cookie') || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`ys_oauth_${provider}=`))
    ?.split('=')[1];
  if (!state || !nonce)
    throw new Error('INPUT:This authorization session expired. Start again.');
  const record = await database()
    .prepare(
      'DELETE FROM oauth_states WHERE state_hash=? AND owner=? AND provider=? AND nonce_hash=? AND expires_at>? RETURNING verifier,redirect_uri',
    )
    .bind(await digest(state), owner, provider, await digest(nonce), Date.now())
    .first<{ verifier: string; redirect_uri: string }>();
  if (!record || !code || q.has('error'))
    throw new Error('INPUT:Authorization was cancelled or expired.');
  const app = await getApp(owner, provider);
  let result = await tokenRequest(provider, app, {
    code,
    redirect_uri: record.redirect_uri,
    ...(provider === 'google'
      ? { grant_type: 'authorization_code', code_verifier: record.verifier }
      : provider === 'tiktok'
        ? { grant_type: 'authorization_code' }
        : {}),
  });
  if (provider === 'meta')
    result = await tokenRequest(provider, app, {
      grant_type: 'fb_exchange_token',
      fb_exchange_token: result.access_token,
    });
  if (provider !== 'meta' && !result.refresh_token)
    throw new Error(
      'INPUT:Offline authorization was not granted. Revoke the old app grant in the provider account and connect again.',
    );
  if (provider === 'google') {
    const previous = await readVault<Grant>(owner, 'grant', provider);
    const linked = await database()
      .prepare(
        "SELECT source FROM connector_links WHERE owner=? AND provider='google'",
      )
      .bind(owner)
      .all<{ source: string }>();
    const granted = String(result.scope || '').split(' ');
    for (const link of linked.results) {
      const needed =
        link.source === 'ga4'
          ? '/auth/analytics.readonly'
          : link.source === 'gbp'
            ? '/auth/business.manage'
            : '';
      if (
        needed &&
        previous?.scopes?.includes(needed) &&
        !granted.some((s: string) => s.endsWith(needed))
      )
        throw new Error(
          'INPUT:Your existing Google connection was preserved. Authorize this service again using the previously connected Google account and retain its previously granted access.',
        );
    }
  }
  await writeVault(owner, 'grant', provider, {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt:
      provider === 'meta'
        ? await metaExpiry(app, result.access_token)
        : Date.now() + Number(result.expires_in || 3600) * 1000,
    openId: result.open_id,
    authorizedAt: new Date().toISOString(),
    scopes: result.scope,
  } satisfies Grant);
}
export async function accessGrant(owner: string, provider: ConnectorProvider) {
  let grant = await readVault<Grant>(owner, 'grant', provider);
  if (!grant)
    throw new Error(
      'INPUT:Authorize this platform before selecting an account.',
    );
  if (grant.expiresAt < Date.now() + 90000) {
    if (provider === 'meta') {
      grant = {
        ...grant,
        expiresAt: await metaExpiry(
          await getApp(owner, provider),
          grant.accessToken,
        ),
      };
      await writeVault(owner, 'grant', provider, grant);
      return grant;
    }
    if (!grant.refreshToken)
      throw new Error(
        'INPUT:Your authorization expired. Connect this platform again.',
      );
    const result = await tokenRequest(provider, await getApp(owner, provider), {
      grant_type: 'refresh_token',
      refresh_token: grant.refreshToken,
    });
    grant = {
      ...grant,
      accessToken: result.access_token,
      refreshToken: result.refresh_token || grant.refreshToken,
      expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000,
    };
    await writeVault(owner, 'grant', provider, grant);
  }
  return grant;
}
export async function discoverResources(
  owner: string,
  provider: ConnectorProvider,
  source?: string,
) {
  const grant = await accessGrant(owner, provider),
    headers = { Authorization: 'Bearer ' + grant.accessToken };
  const resources: Resource[] = [],
    warnings: string[] = [];
  if (provider === 'google') {
    if (
      source !== 'gbp' &&
      (!grant.scopes || grant.scopes.includes('/auth/analytics.readonly'))
    )
      try {
        let next = '';
        for (let page = 0; page < 10; page++) {
          const r = await requestJSON(
            'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200' +
              (next ? '&pageToken=' + encodeURIComponent(next) : ''),
            { headers },
          );
          for (const a of r.accountSummaries || [])
            for (const p of a.propertySummaries || [])
              resources.push({
                source: 'ga4',
                id: p.property.replace('properties/', ''),
                label: p.displayName + ' · ' + a.displayName,
              });
          next = r.nextPageToken;
          if (!next) break;
          if (page === 9)
            warnings.push(
              'Only the first 2,000 Google Analytics accounts are listed.',
            );
        }
      } catch {
        warnings.push(
          'Analytics properties could not be listed. Enable the Admin API and confirm account access.',
        );
      }
    if (
      source !== 'ga4' &&
      (!grant.scopes || grant.scopes.includes('/auth/business.manage'))
    )
      try {
        let next = '';
        for (let page = 0; page < 10; page++) {
          const a = await requestJSON(
            'https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20' +
              (next ? '&pageToken=' + encodeURIComponent(next) : ''),
            { headers },
          );
          for (const account of a.accounts || []) {
            let locNext = '';
            for (let lp = 0; lp < 10; lp++) {
              const locations = await requestJSON(
                'https://mybusinessbusinessinformation.googleapis.com/v1/' +
                  account.name +
                  '/locations?readMask=name,title&pageSize=100' +
                  (locNext ? '&pageToken=' + encodeURIComponent(locNext) : ''),
                { headers },
              );
              for (const l of locations.locations || [])
                resources.push({
                  source: 'gbp',
                  id: l.name.replace('locations/', ''),
                  label: l.title,
                });
              locNext = locations.nextPageToken;
              if (!locNext) break;
              if (lp === 9)
                warnings.push(
                  'Only the first 1,000 locations per business account are listed.',
                );
            }
          }
          next = a.nextPageToken;
          if (!next) break;
        }
      } catch {
        warnings.push(
          'Business locations could not be listed. Google Business Profile API approval and quota may still be needed.',
        );
      }
  } else if (provider === 'meta') {
    const app = await getApp(owner, provider);
    let after = '';
    for (let page = 0; page < 10; page++) {
      const r = await requestJSON(
        `https://graph.facebook.com/${app.apiVersion}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100` +
          (after ? '&after=' + encodeURIComponent(after) : ''),
        { headers },
      );
      for (const p of r.data || []) {
        resources.push({
          source: 'facebook',
          id: p.id,
          label: p.name,
          pageToken: p.access_token,
        });
        if (p.instagram_business_account)
          resources.push({
            source: 'instagram',
            id: p.instagram_business_account.id,
            label: p.instagram_business_account.username || p.name,
            pageToken: p.access_token,
          });
      }
      after = r.paging?.cursors?.after;
      if (!r.paging?.next || !after) break;
    }
    if (!resources.length)
      warnings.push(
        'No accessible Pages found. Check Page access, test users and the linked professional Instagram account.',
      );
  } else {
    const r = await requestJSON(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
      { headers },
    );
    if (r.error?.code && r.error.code !== 'ok')
      throw new Error(
        'INPUT:TikTok permissions need attention. Authorize the requested scopes.',
      );
    if (r.data?.user?.open_id)
      resources.push({
        source: 'tiktok',
        id: r.data.user.open_id,
        label: r.data.user.display_name,
      });
  }
  if (resources.length > 2000)
    throw new Error(
      'INPUT:This account contains too many resources. Use an account with access to the Ysabel Society properties.',
    );
  // A source-specific discovery must not discard resources selected for the other Google product.
  const kept = source
    ? (grant.resources || []).filter((r) => r.source !== source)
    : [];
  await writeVault(owner, 'grant', provider, {
    ...grant,
    resources: [...kept, ...resources],
  });
  return {
    resources: resources.map(({ source, id, label }) => ({
      source,
      id,
      label,
    })),
    warnings,
  };
}
