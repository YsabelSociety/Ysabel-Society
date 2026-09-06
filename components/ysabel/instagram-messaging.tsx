'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';

export function InstagramMessaging({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState('');
  const [version, setVersion] = useState('v26.0');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/instagram-messaging', { signal: controller.signal })
      .then((r) => r.json())
      .then((r: any) => {
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
      const response = await fetch('/api/instagram-messaging', {
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
        'Access verified for @' + result.username + '. Loading messages…',
      );
      onSaved();
      const imported = await fetch('/api/community', {
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
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
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
