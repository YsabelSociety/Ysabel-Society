'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Mail, RefreshCw } from 'lucide-react';
import styles from './email-marketing.module.css';

export default function EmailMarketing() {
  const frame = useRef<HTMLIFrameElement>(null);
  const disconnect = useRef<() => void>(()=>{});
  const [status, setStatus] = useState({state:'loading', label:'Opening email intelligence…', updated:''});
  const [version, setVersion] = useState(0);
  const [view, setView] = useState('overview');
  const connectDocument = useCallback(() => {
    disconnect.current();
    const doc = frame.current?.contentDocument;
    if (!doc) { setStatus({state:'error', label:'Open MailSignal to check the connection', updated:''}); return; }
    const check = () => {
      const service = doc.getElementById('service-status')?.textContent || '';
      const light = doc.getElementById('service-light')?.getAttribute('data-state');
      const connected = service === 'Service connected';
      const signedOut = doc.getElementById('page-title')?.textContent?.includes('signed out');
      const next = {
        state:light === 'warning' ? 'error' : connected ? 'connected' : signedOut ? 'signed-out' : doc.getElementById('page-title') ? 'loading' : 'error',
        label:light === 'warning' ? 'Email connection needs attention' : connected ? 'Connected · live activity' : signedOut ? 'Sign in to Ysabel Society again' : doc.getElementById('page-title') ? 'Loading your saved workspace…' : 'Email workspace could not be loaded',
        updated:doc.getElementById('updated')?.textContent || '',
      };
      setStatus(previous=>previous.state===next.state && previous.label===next.label && previous.updated===next.updated ? previous : next);
    };
    const observer = new MutationObserver(check);
    for (const id of ['service-status', 'service-light', 'page-title', 'updated', 'notice']) {
      const element = doc.getElementById(id); if (element) observer.observe(element,{childList:true, subtree:true, characterData:true, attributes:true});
    }
    // Google OAuth must run in a normal tab. Keep Gmail authorization and help
    // on the existing MailSignal route; do not recreate or broaden permissions.
    const leaveFrame = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('#gmail-connect')) {
        event.preventDefault(); event.stopImmediatePropagation();
        window.open('/mailsignal#connections', '_blank', 'noopener,noreferrer');
        return;
      }
      const anchor = target?.closest('a');
      const href = anchor?.getAttribute('href');
      if (anchor && href && !href.startsWith('#') && !anchor.hasAttribute('download')) {
        let url: URL; try { url = new URL(href, window.location.origin + '/mailsignal/'); } catch { return; }
        if (['https:', 'http:'].includes(url.protocol)) { event.preventDefault(); window.open(url.href, '_blank', 'noopener,noreferrer'); }
      }
    };
    doc.addEventListener('click', leaveFrame, true);
    const child = frame.current?.contentWindow;
    const readView = () => { const value = child?.location.hash.slice(1) || 'overview'; if (['overview','analytics','links','people','campaigns','documents','connections'].includes(value)) setView(value); };
    child?.addEventListener('hashchange',readView);
    disconnect.current = () => { observer.disconnect(); doc.removeEventListener('click',leaveFrame,true); child?.removeEventListener('hashchange',readView); };
    readView();
    check();
  }, []);
  useEffect(()=>()=>disconnect.current(),[]);
  const refresh = () => {
    const button = frame.current?.contentDocument?.getElementById('refresh') as HTMLButtonElement | null;
    if (button && !button.disabled) button.click();
    else if (!button) { setStatus({state:'loading',label:'Opening email intelligence…',updated:''}); setVersion(value=>value+1); }
  };
  return <section className={styles.shell} aria-label="Ysabel Society · Email Intelligence">
    <div className={styles.toolbar}>
      <div className={styles.identity}><span className={styles.mark}><Mail size={19}/></span><div><strong>Ysabel Email Intelligence</strong><span>Newsletters, people & conversations</span></div></div>
      <div className={styles.connection} data-state={status.state} role="status"><i/><span>{status.label}<small>{status.updated}</small></span></div>
      <div className={styles.actions}>
        <button type="button" className="secondary" onClick={refresh} disabled={status.state==='loading' || status.state==='signed-out'}><RefreshCw size={14}/>Refresh</button>
        <a className="secondary" href="/mailsignal" target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/><span>Open separately</span></a>
      </div>
      <label className={styles.mobileViews}>Email section<select value={view} onChange={event=>{setView(event.target.value); if(frame.current?.contentWindow) frame.current.contentWindow.location.hash=event.target.value;}}>{[['overview','Overview'],['analytics','Analytics'],['links','Links & destinations'],['people','People'],['campaigns','Campaigns'],['documents','Documents'],['connections','Connections']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <iframe key={version} ref={frame} src="/marketingdata/email-marketing#overview" title="Ysabel Society · Email Intelligence" className={styles.frame} onLoad={connectDocument} allow="clipboard-write; fullscreen" referrerPolicy="no-referrer" />
    <p className={styles.note}>Your saved email activity, connected through your Ysabel sign-in on every device. Reports refresh every minute; Gmail synchronizes automatically in the background. Shared Bcc copies cannot identify individual readers.</p>
  </section>;
}
