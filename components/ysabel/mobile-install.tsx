'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function MobileInstall() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const prompt = useRef<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/marketingdata/sw.js', {
        scope: '/marketingdata/', updateViaCache: 'none',
      }).catch(() => {});
    }
    const standalone = window.matchMedia('(display-mode: standalone)');
    const installed = () => standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
    const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIos(apple);
    setVisible(!installed());
    const ready = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
      if (!installed()) setVisible(true);
    };
    const done = () => { setVisible(false); prompt.current = null; dialog.current?.close(); };
    const mode = () => { if (installed()) done(); };
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', done);
    standalone.addEventListener('change', mode);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', done);
      standalone.removeEventListener('change', mode);
    };
  }, []);
  async function install() {
    if (!prompt.current) { dialog.current?.showModal(); return; }
    setBusy(true);
    const event = prompt.current;
    prompt.current = null;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') setVisible(false);
    } catch {
      setMessage('Use your browser menu to add Ysabel Society to your home screen.');
      dialog.current?.showModal();
    } finally { setBusy(false); }
  }
  if (!visible) return null;
  return <>
    <div className="mobile-install-bar" role="status" aria-label="Install Ysabel Society">
      <button type="button" onClick={install} disabled={busy}><img src="/marketingdata/icons/ysabel-192.png" alt="" width={42} height={42} /><span><strong>Ysabel Society</strong><small>{busy ? 'Opening…' : 'Install app on your device'}</small></span></button>
      <button type="button" aria-label="Dismiss install shortcut" onClick={() => setVisible(false)}><X size={14} /></button>
    </div>
    <dialog ref={dialog} className="mobile-install-dialog" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <img src="/marketingdata/icons/ysabel-192.png" alt="Ysabel Society" width={72} height={72} />
      <h2>Ysabel Society on your phone</h2>
      <p>{message || (ios ? 'Open this page in Safari. Tap Share, then Add to Home Screen and Add.' : 'Open your browser menu and choose Install app or Add to Home screen. If it is missing, open this page in Chrome or Safari.')}</p>
      <p>Your marketing workspace opens directly from its own icon.</p>
      <form method="dialog"><button autoFocus type="submit">Got it</button></form>
    </dialog>
  </>;
}
