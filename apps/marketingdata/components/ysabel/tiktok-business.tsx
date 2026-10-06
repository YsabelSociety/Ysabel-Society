'use client';
import { useEffect, useState } from 'react';
export function TikTokBusinessSetup() {
  const [info, setInfo] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [clientId, setId] = useState(''),
    [clientSecret, setSecret] = useState(''),
    [authorizationUrl, setUrl] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/marketingdata/api/tiktok-business', { signal: controller.signal })
      .then(async (r) => {
        const data = (await r.json()) as any;
        if (!r.ok)
          throw new Error(data.error || 'Could not read connection status.');
        setInfo(data);
        setId(data.clientId);
        if (
          new URLSearchParams(window.location.search).get('status') === 'failed'
        )
          setError(
            'TikTok authorization did not complete. Check approval, sign in to the dashboard, and try again.',
          );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function action(op: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/marketingdata/api/tiktok-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op,
          ...(op === 'save'
            ? { clientId, clientSecret, authorizationUrl }
            : {}),
        }),
      });
      const result = (await response.json()) as any;
      if (!response.ok)
        throw new Error(result.error || 'Connection did not complete.');
      if (op === 'authorize') window.location.assign(result.url);
      else {
        setInfo(result);
        setSecret('');
        setUrl('');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="community-help">
      <h2>TikTok profile analytics</h2>
      <p>
        Connect the approved Accounts API to synchronize Ysabel Society’s daily profile visits. Your existing video connection remains active.
      </p>
      <ol>
        <li>
          Complete TikTok’s Accounts API access application with business verification and a demonstration, then request Account User basic information and insights in your app review.
        </li>
        <li>
          Register the account sign-in callback shown below. The account authorization needs user.insights and user.info.username so the app can read profile visits and verify the connected account.
        </li>
        <li>
          After approval, save the Business API app ID, secret and official account holder authorization URL. Authorize the same Ysabel account, then sync profile visits here or refresh TikTok in Performance.
        </li>
      </ol>
      <div className="inline-actions">
        <a
          className="secondary"
          target="_blank"
          rel="noreferrer"
          href="https://business-api.tiktok.com/portal"
        >
          Open TikTok Business
        </a>
        <a
          target="_blank"
          rel="noreferrer"
          href="https://business-api.tiktok.com/portal/docs/accounts-api-overview/v1.3"
        >
          Accounts API approval requirements
        </a>
      </div>
      {info && (
        <label>
          Account sign-in callback
          <input
            readOnly
            value={info.callbackUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
      <p role="status">
        {info?.analyticsAuthorized
          ? 'Analytics authorization saved. Sync profile visits to verify provider data. Daily figures can take 24–48 hours to arrive.'
          : info?.authorized
          ? 'Business authorization saved, but user.insights and user.info.username are still required for profile visits.'
          : info?.configured
            ? 'App settings saved. Account authorization is still required.'
            : 'Business account authorization has not been completed.'}
      </p>
      <form
        className="community-profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          void action('save');
        }}
      >
        <label>
          Business API app ID
          <input
            value={clientId}
            onChange={(e) => setId(e.target.value)}
            required
            pattern="[0-9]{5,30}"
            maxLength={30}
          />
        </label>
        <label>
          App secret
          <input
            type="password"
            autoComplete="off"
            value={clientSecret}
            onChange={(e) => setSecret(e.target.value)}
            required
            maxLength={1000}
          />
        </label>
        <label>
          TikTok account holder authorization URL
          <input
            type="url"
            value={authorizationUrl}
            onChange={(e) => setUrl(e.target.value)}
            required
            maxLength={6000}
          />
        </label>
        <button type="submit" className="secondary" disabled={busy}>
          Save approved app settings
        </button>
      </form>
      <button
        type="button"
        className="primary"
        disabled={busy || !info?.configured}
        onClick={() => void action('authorize')}
      >
        {busy ? 'Please wait…' : 'Authorize TikTok Business account'}
      </button>
      <button type="button" className="secondary" disabled={busy || !info?.analyticsAuthorized} onClick={() => void action('sync')}>
        {busy ? 'Syncing…' : 'Sync profile visits'}
      </button>
      {info?.sync?.snapshot && <p role="status">{info.sync.snapshot.checks?.find((check: any) => check.key === 'profile-views')?.detail}</p>}
      {error && <p role="alert">{error}</p>}
      <p>
        Profile visits use TikTok’s Accounts API and UTC reporting dates, with a maximum 60-day lookback. Earlier history stays saved in the app. Missing days remain unavailable until TikTok supplies them. Messaging and mentions have separate approval requirements.
      </p>
    </div>
  );
}
