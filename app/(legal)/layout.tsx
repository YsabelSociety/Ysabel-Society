import type { ReactNode } from 'react';
import { appPath } from '@/lib/app-path';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '48px 24px',
        background: '#f5f5ef',
        color: '#29362b',
      }}
    >
      <article style={{ maxWidth: 760, margin: '0 auto', lineHeight: 1.8 }}>
        <a
          href={appPath('/login')}
          style={{ display: 'inline-block', marginBottom: 28 }}
        >
          <img
            src={appPath('/ysabel-society-logo.png')}
            alt="Ysabel Society"
            width={210}
            height={118}
            style={{ objectFit: 'contain' }}
          />
        </a>
        <p style={{ fontSize: 12, letterSpacing: '0.12em' }}>
          YSABEL SOCIETY · DIGITAL INTELLIGENCE
        </p>
        {children}
        <nav
          aria-label="Legal information"
          style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            marginTop: 40,
            paddingTop: 20,
            borderTop: '1px solid #ccd1c5',
          }}
        >
          <a href={appPath('/login')}>Workspace sign-in</a>
          <a href={appPath('/privacy')}>Privacy policy</a>
          <a href={appPath('/terms')}>Terms of use</a>
          <a href="https://ysabelsociety.com/">Contact Ysabel Society</a>
        </nav>
      </article>
    </main>
  );
}
