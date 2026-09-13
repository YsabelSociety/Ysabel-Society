'use client';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { LockKeyhole, ShieldCheck, ArrowRight } from 'lucide-react';
import { appPath } from '@/lib/app-path';
import styles from './admin-gate.module.css';

export function AdminGate({
  children,
  title = 'Administrator access',
}: {
  children: ReactNode;
  title?: string;
}) {
  const [expiresAt, setExpiresAt] = useState(0);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const check = useCallback(async () => {
    try {
      const r = await fetch(appPath('/api/admin-access'), {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      const d = (await r.json()) as {
        unlocked: boolean;
        expiresAt: number;
        error?: string;
      };
      if (!r.ok)
        throw new Error(d.error || 'Unable to check administrator access.');
      setExpiresAt(d.unlocked ? d.expiresAt : 0);
      setError('');
    } catch (e) {
      setExpiresAt(0);
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [check]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => setExpiresAt(0),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  if (expiresAt > Date.now())
    return (
      <>
        <div className={styles.unlocked}>
          <span>
            <ShieldCheck size={15} /> Administrator access unlocked
          </span>
          <button
            className="secondary"
            onClick={async () => {
              try {
                const r = await fetch(appPath('/api/admin-access'), {
                  method: 'DELETE',
                });
                if (!r.ok) throw new Error('Could not lock access. Try again.');
                setExpiresAt(0);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LockKeyhole size={14} /> Lock
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {children}
      </>
    );
  return (
    <section className={'surface ' + styles.gate} aria-label={title}>
      <span className={styles.seal}>
        <LockKeyhole size={25} strokeWidth={1.4} />
      </span>
      <h2>{title}</h2>
      <p>Enter the administrator PIN to open this section.</p>
      {checking ? (
        <p role="status">Checking access…</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const r = await fetch(appPath('/api/admin-access'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin }),
                signal: AbortSignal.timeout(15000),
              });
              const d = (await r.json()) as {
                expiresAt: number;
                error?: string;
              };
              if (!r.ok)
                throw new Error(d.error || 'Unable to unlock this section.');
              setExpiresAt(d.expiresAt);
              setPin('');
            } catch (e) {
              setError((e as Error).message);
              setPin('');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="admin-pin">Six-digit PIN</label>
          <input
            id="admin-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            required
            disabled={busy}
            aria-describedby={error ? 'admin-pin-error' : undefined}
          />
          {error && (
            <p id="admin-pin-error" role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || pin.length !== 6}>
            {busy ? 'Checking PIN…' : 'Unlock'}
            <ArrowRight size={16} />
          </button>
        </form>
      )}
    </section>
  );
}
