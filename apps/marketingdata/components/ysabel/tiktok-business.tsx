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
      <h2>TikTok messages & mentions</h2>
      <p>
        Complete TikTok’s Business API approval, then authorize the Ysabel
        Society account here.
      </p>
      <ol>
        <li>
          Register in TikTok API for Business and submit the app for review.
          Messaging requires TikTok’s separate data-security review after app
          approval.
        </li>
        <li>
          Upload the Ysabel logo and set the TikTok account holder redirect URL
          shown below. Request Mentions separately.
        </li>
        <li>
          After approval, save the Business API app ID, secret and TikTok
          account holder authorization URL. This is separate from the existing
          TikTok analytics login.
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
          href="https://business-api.tiktok.com/portal/docs/access-to-business-messaging-api/v1.3"
        >
          Messaging approval requirements
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
        {info?.authorized
          ? 'Business authorization saved. Live messages and mentions have not yet been verified or imported through this connection.'
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
      {error && <p role="alert">{error}</p>}
      <p>
        TikTok currently excludes Business Accounts and incoming messages from
        the EEA, Switzerland and UK. US accounts need an additional review.
        Authorization alone does not verify message access; automatic
        business-message imports are not active yet. Existing video statistics
        and file imports keep their current connection.
      </p>
    </div>
  );
}
