'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';

export function InstagramMessaging({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState('');
  const [version, setVersion] = useState('v26.0');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginReady, setLoginReady] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  async function loginAction(op: 'login' | 'login-setup') {
    setBusy(true); setError('');
    try {
      const response = await fetch('/marketingdata/api/instagram-messaging', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,...(op === 'login-setup' ? {clientId,clientSecret,apiVersion:version} : {})})});
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || 'Instagram sign-in could not start.');
      if (op === 'login') window.location.assign(result.url);
      else { setLoginReady(true); setClientSecret(''); setStatus('Instagram sign-in is ready.'); }
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const [checks, setChecks] = useState<{ label: string; detail: string }[]>([]);
  async function diagnose() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/marketingdata/api/instagram-messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'diagnose' }),
      });
      const result: any = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Access checks did not complete.');
      setChecks(result.results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch('/marketingdata/api/instagram-messaging', { signal: controller.signal })
      .then((r) => r.json())
      .then((r: any) => {
        setLoginReady(!!r.loginReady);
        setClientId(r.clientId || '');
        if (r.connected)
          setStatus(
            'Direct Instagram configured for @' +
              r.username +
              '. Import messages to check current access.',
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setStatus('Checking your Instagram account and conversation access…');
    try {
      const response = await fetch('/marketingdata/api/instagram-messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, apiVersion: version }),
      });
      const result: any = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || 'Instagram could not verify this connection.',
        );
      setToken('');
      setStatus(
        'Account linked for @' + result.username + '. Checking messages…',
      );
      onSaved();
      const imported = await fetch('/marketingdata/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'sync', source: 'instagram' }),
      });
      const data: any = await imported.json();
      if (!imported.ok)
        throw new Error(data.error || 'Message import did not complete.');
      setStatus(data.detail || 'Instagram import finished.');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="community-help">
      <h3>Connect directly to Instagram</h3>
      <p>Sign in on Instagram and authorize Ysabel Society to read accessible conversations and client profiles.</p>
      <button className="primary" type="button" disabled={busy || !loginReady} onClick={() => loginAction('login')}>Sign in with Instagram <ArrowUpRight size={15}/></button>
      {!loginReady && <p>Complete the one-time Instagram login settings below to enable sign-in.</p>}
      <details>
        <summary>Instagram login settings</summary>
        <p>Use the Instagram app ID and secret from API setup with Instagram login.</p>
        <p>Redirect URL: <code>https://ysabelsociety.com/marketingdata/api/instagram-messaging/callback</code></p>
        <form className="community-profile-form" onSubmit={e => {e.preventDefault(); void loginAction('login-setup');}}>
          <label>Instagram app ID<input value={clientId} onChange={e => setClientId(e.target.value)} required inputMode="numeric"/></label>
          <label>Instagram app secret<input type="password" autoComplete="off" value={clientSecret} onChange={e => setClientSecret(e.target.value)} required/></label>
          <button className="secondary" disabled={busy}>Save Instagram login settings</button>
        </form>
      </details>
      <details>
        <summary>Advanced: connect with an existing access token</summary>
      <p>
        Use the Instagram connection for the business account you own. It can be
        used when the Facebook-linked message import is restricted. Facebook
        messages and existing reports keep their own connection.
      </p>
      <ol>
        <li>
          Open your Meta app → Instagram API → API setup with Instagram login.
          Add the messaging permissions.
        </li>
        <li>
          Add @ysabelsociety as an Instagram tester. Sign into that account and
          accept the invitation under Apps and websites → Tester invites.
        </li>
        <li>
          Return to Meta and generate the Instagram access token for that
          account. Paste it below. The app checks the account and message access
          before saving.
        </li>
      </ol>
      <div className="inline-actions">
        <a
          className="secondary"
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noreferrer"
        >
          Open Meta app <ArrowUpRight size={15} />
        </a>
        <a
          className="secondary"
          href="https://www.instagram.com/accounts/manage_access/"
          target="_blank"
          rel="noreferrer"
        >
          Accept Instagram invitation <ArrowUpRight size={15} />
        </a>
      </div>
      <form onSubmit={connect} className="community-profile-form">
        <label>
          Instagram access token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            maxLength={6000}
          />
        </label>
        <label>
          API version shown in Meta
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            required
            pattern="v[0-9]{1,2}\.[0-9]{1,2}"
          />
        </label>
        <button
          className="primary"
          disabled={busy || !token.trim()}
          type="submit"
        >
          <RefreshCw size={15} className={busy ? 'spinning' : ''} />
          {busy ? 'Checking Instagram…' : 'Verify & load Instagram messages'}
        </button>
      </form>
      </details>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      <button
        className="secondary"
        type="button"
        disabled={busy}
        onClick={diagnose}
      >
        {busy ? 'Checking access…' : 'Check all Instagram connection routes'}
      </button>
      {checks.length > 0 && (
        <ul aria-label="Instagram connection checks">
          {checks.map((c) => (
            <li key={c.label}>
              <strong>{c.label}</strong>
              <p>{c.detail}</p>
            </li>
          ))}
        </ul>
      )}
      <p>
        After connection, automatic refresh checks accessible messages while the
        workspace is open and auto-sync is enabled. Replace the token here if
        Instagram expires or revokes it.
      </p>
      <p>
        Primary, General and eligible Requests are queried together. Instagram
        excludes Requests inactive for 30 days and exposes only recent message
        details. Use a Meta JSON download for older available history. Group
        chats, deleted messages and expired stories may be unavailable.
      </p>
      <a
        href="https://www.postman.com/meta/instagram/folder/23987686-6a91368f-1fa8-4614-9ed6-7d1e08c21e62"
        target="_blank"
        rel="noreferrer"
      >
        Meta’s direct Instagram access requirements
      </a>
    </div>
  );
}
