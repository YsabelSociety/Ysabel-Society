"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
    {instructions && <div id="install-help" className={styles.installHelp} role="region" aria-label="Installation instructions">
      <Image unoptimized src="/contentpreview-icons/olive-silver-192.png" width={64} height={64} alt="Ysabel Society silver emblem on dark olive" />
      <strong>Ysabel on your home screen</strong>
      {ios ? <ol><li>Tap the browser’s <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Enable <b>Open as Web App</b> if shown, then tap <b>Add</b>.</li></ol> : <ol><li>Open your browser’s <b>⋮ menu</b>.</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Confirm <b>Install</b>. If unavailable, open this page in Chrome or Edge.</li></ol>}
      <button onClick={() => setInstructions(false)}>Close</button>
    </div>}
    <button className={styles.installButton} aria-expanded={instructions} aria-controls={instructions ? 'install-help' : undefined} onClick={async () => {
      if (!prompt) { setInstructions((value) => !value); return; }
      try { await prompt.prompt(); await prompt.userChoice; } catch { setInstructions(true); }
      setPrompt(null);
    }}><Image unoptimized src="/contentpreview-icons/olive-silver-192.png" width={32} height={32} alt="" /><span>Install Ysabel app<small>Add to your home screen</small></span><span aria-hidden="true">＋</span></button>
  </aside>;
}
