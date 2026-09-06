'use client';
import { useState } from 'react';
import { LockKeyhole, ArrowRight } from 'lucide-react';
import { BrandLogo } from './brand-logo';
import { LoginScene } from './login-scene';
import { appPath, safeReturnPath } from '@/lib/app-path';
export default function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-shell">
      <LoginScene />
      <section className="login-access">
        <div className="login-card">
          <BrandLogo />
          <div className="brand-caption">DIGITAL INTELLIGENCE</div>
          <h1>Welcome back.</h1>
          <p className="muted">Sign in to your Ysabel Society workspace.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const data = new FormData(e.currentTarget);
              try {
                const response = await fetch(appPath('/api/session'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username: data.get('username'),
                    password: data.get('password'),
                  }),
                });
                const body = (await response.json()) as { error?: string };
                if (!response.ok)
                  throw new Error(
                    body.error || 'Sign-in is temporarily unavailable.',
                  );
                location.assign(
                  safeReturnPath(
                    new URLSearchParams(location.search).get('returnTo'),
                  ),
                );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : 'Sign-in is temporarily unavailable.',
                );
                setBusy(false);
              }
            }}
          >
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <button className="primary" type="submit" disabled={busy}>
              <LockKeyhole size={17} />
              {busy ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="login-private">
            <LockKeyhole size={13} /> Private workspace · Ysabel Society
          </p>
        </div>
      </section>
    </main>
  );
}
