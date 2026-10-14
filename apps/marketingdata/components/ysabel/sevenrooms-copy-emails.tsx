'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Copy,Mail,X} from 'lucide-react';
import {AdminGate} from './admin-gate';

export function CopyEmailsButton({query,title,disabled=false}:{query:string;title:string;disabled?:boolean}){
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!open)return;
  const modal=dialog.current;
  modal?.showModal();
  return()=>{modal?.close();trigger.current?.focus();};
 },[open]);
 return <>
  <button ref={trigger} type="button" className="sr-copy-button" disabled={disabled} onClick={()=>setOpen(true)} aria-label={'Copy marketing emails · '+title}><Copy size={15}/>Copy emails</button>
  {open&&<dialog ref={dialog} className="sr-copy-dialog" aria-label="Copy marketing emails" onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===dialog.current)setOpen(false);}}>
   <header><div><span className="sr-copy-eyebrow"><Mail size={14}/>SEVENROOMS / EMAIL MARKETING</span><h2>Copy marketing emails</h2></div><button type="button" aria-label="Close email copy" onClick={()=>setOpen(false)}><X size={19}/></button></header>
   <p className="sr-copy-scope">{title}</p>
   <AdminGate title="Copy marketing emails"><CopyAudience query={query}/></AdminGate>
  </dialog>}
 </>;
}

function CopyAudience({query}:{query:string}){
 const [summary,setSummary]=useState<{count:number;eligible:number}|null>(null),[separator,setSeparator]=useState('line'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[manual,setManual]=useState(''),[revision,setRevision]=useState(0);
 const field=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{
  const abort=new AbortController();setSummary(null);setLoading(true);setError('');setMessage('');setManual('');
  const params=new URLSearchParams(query);params.set('format','copy');params.set('counts','yes');
  fetch('/marketingdata/api/sevenrooms-export?'+params,{cache:'no-store',signal:abort.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not prepare this audience.');if(!Number.isInteger(data.count))throw new Error('Could not verify this audience.');return data;}).then(data=>{if(!abort.signal.aborted)setSummary(data);}).catch(reason=>{if(!abort.signal.aborted)setError(reason.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[query,revision]);
 async function copy(){
  setBusy(true);setError('');setMessage('');setManual('');
  try{
   const params=new URLSearchParams(query);params.set('format','copy');params.delete('counts');
   const response=await fetch('/marketingdata/api/sevenrooms-export?'+params,{cache:'no-store',signal:AbortSignal.timeout(60000)}),data=await response.json();
   if(!response.ok)throw new Error(data.error||'Could not prepare the email list.');
   if(!Array.isArray(data.emails)||!data.emails.length)throw new Error('No marketing-eligible emails match this selection.');
   const text=data.emails.join(separator==='line'?'\n':', ');
   setSummary(previous=>({...previous!,count:data.emails.length}));
   try{await navigator.clipboard.writeText(text);setMessage(data.emails.length.toLocaleString('en')+' email addresses copied.');}
   catch{setManual(text);setMessage('Your browser could not copy automatically. Select the list below and copy it.');}
  }catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 return <div className="sr-copy-content" aria-busy={loading||busy}>
  <div className="sr-copy-total"><strong>{loading?'—':summary?.count.toLocaleString('en')||'0'}</strong><span>Unique marketing emails</span></div>
  <p className="sr-copy-note">{loading?'Checking the complete audience…':summary?summary.eligible.toLocaleString('en')+' eligible guest profiles · duplicate addresses removed.':''}</p>
  <p className="sr-copy-note">All matching pages are included. Only valid email addresses with confirmed marketing consent and no suppression are copied.</p>
  <label className="sr-copy-format">Separate addresses with<select aria-label="Email separator" value={separator} disabled={busy} onChange={event=>{setSeparator(event.target.value);setManual('');setMessage('');}}><option value="line">A new line</option><option value="comma">A comma</option></select></label>
  <button type="button" className="sr-primary sr-copy-confirm" disabled={loading||busy||!summary?.count} onClick={copy}>{message&&!manual?<Check size={16}/>:<Copy size={16}/>} {busy?'Preparing the full list…':'Copy '+(summary?.count.toLocaleString('en')||'')+' emails'}</button>
  {error&&<p role="alert" className="sr-error">{error} <button type="button" onClick={()=>setRevision(v=>v+1)}>Retry</button></p>}
  {message&&<p role="status" className="sr-copy-message">{message}</p>}
  {manual&&<div className="sr-copy-manual"><textarea ref={field} aria-label="Email list to copy" readOnly value={manual} rows={8}/><button type="button" onClick={()=>{field.current?.focus();field.current?.select();}}>Select email list</button></div>}
 </div>;
}
