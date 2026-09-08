"use client";

import { useEffect, useState } from "react";
import styles from "./contentpreview.module.css";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [instructions, setInstructions] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    update();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const complete = () => { setInstalled(true); setPrompt(null); setInstructions(false); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    standalone.addEventListener('change', update);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', complete);
      standalone.removeEventListener('change', update);
    };
  }, []);
  if (installed) return null;
  return <aside className={styles.install} aria-label="Install Content Preview">
    {instructions && <div className={styles.installHelp} role="status">
      <strong>Ysabel on your home screen</strong>
      <p>{ios ? 'Tap Share in your browser, then Add to Home Screen. Enable Open as Web App if shown, then tap Add.' : 'Open your browser menu and choose Install app or Add to Home screen. If unavailable, open this page in Chrome or Edge.'}</p>
      <button onClick={() => setInstructions(false)}>Close</button>
    </div>}
    <button className={styles.installButton} onClick={async () => {
      if (!prompt) { setInstructions((value) => !value); return; }
      try { await prompt.prompt(); await prompt.userChoice; } catch { setInstructions(true); }
      setPrompt(null);
    }}>＋ Install app</button>
  </aside>;
}
