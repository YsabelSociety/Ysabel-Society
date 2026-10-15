'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowDownToLine,ArrowUpRight,MailCheck,MailX,ShieldAlert,HelpCircle,ShieldX,X} from 'lucide-react';
import {AdminGate} from './admin-gate';
import {CopyEmailsButton} from './sevenrooms-copy-emails';
import {sevenRoomsApi,peekSevenRooms} from '../../lib/sevenrooms-read';

const definitions=[
 {key:'yes',title:'Yes · subscribed',note:'Consistent consent across every profile sharing the email.',Icon:MailCheck},
 {key:'no',title:'No · not subscribed',note:'Marketing consent is recorded as No.',Icon:MailX},
 {key:'conflict',title:'Needs review',note:'The same email appears on profiles with both Yes and No.',Icon:ShieldAlert},
 {key:'unknown',title:'Consent unknown',note:'Permission is missing or unclear. Kept out of marketing lists.',Icon:HelpCircle},
 {key:'blocked',title:'Blocked',note:'At least one profile sharing this email is suppressed.',Icon:ShieldX}
];
type Group=typeof definitions[number];
type Summary={total:number;profiles:number;emailProfiles:number;withoutEmail:number;groups:Record<string,{emails:number;profiles:number}>;imported?:{created_at:string;updated_at:string;filename:string}};

export function SevenRoomsConsent({venue,revision,onView}:{venue:string;revision:number;onView:(group:string)=>void}){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[exportGroup,setExportGroup]=useState<Group|null>(null);
 useEffect(()=>{
  const abort=new AbortController(),query=new URLSearchParams({op:'consent-summary',venue}).toString();setData((peekSevenRooms(query) as Summary)||null);setError('');setLoading(true);
  sevenRoomsApi(query).then(result=>{if(!abort.signal.aborted)setData(result as Summary);}).catch(reason=>{if(!abort.signal.aborted)setError(reason.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[venue,revision,retry]);
 const shown=definitions.filter(group=>['yes','no','conflict'].includes(group.key)||!!data?.groups[group.key]?.emails);
 return <section className="sr-consent" aria-label="Email consent groups" aria-busy={loading}>
  <header className="sr-section-title"><div><h3>Email consent</h3><p className="sr-muted">Unique emails across the selected venue. Consent is checked against every matching profile in the database.</p></div><span>{data?data.total.toLocaleString('en')+' unique emails':'Checking consent…'}</span></header>
  {error&&<p className="sr-error" role="alert">{error} <button onClick={()=>setRetry(value=>value+1)}>Retry</button></p>}
  <div className="sr-consent-grid">{shown.map(group=>{const totals=data?.groups[group.key]||{emails:0,profiles:0};return <article className={'sr-consent-card sr-consent-'+group.key} key={group.key}>
   <span className="sr-consent-label"><group.Icon size={18}/>{group.title}</span><strong>{data?totals.emails.toLocaleString('en'):'—'}</strong><p>{group.note}</p>
   <small>{data?totals.profiles.toLocaleString('en')+' guest profiles · duplicate emails removed':'Checking the full database…'}</small>
   <div className="sr-consent-actions"><button disabled={!data||!totals?.emails} onClick={()=>onView(group.key)}>View guests <ArrowUpRight size={14}/></button><button disabled={!data||!totals?.emails} onClick={()=>setExportGroup(group)}><ArrowDownToLine size={14}/>Export</button></div>
  </article>;})}</div>
  <p className="sr-muted sr-consent-footnote">Only “Yes · subscribed” is included in marketing exports and bulk copying. Other groups export as internal consent registers.</p>
  {data&&<p className="sr-muted sr-consent-footnote">{data.emailProfiles.toLocaleString('en')} profiles have an email · {data.withoutEmail.toLocaleString('en')} profiles have no valid email.{data.imported&&' Client data imported '+new Date(data.imported.updated_at||data.imported.created_at).toLocaleString()+'.'}</p>}
  {exportGroup&&data&&<ConsentExport key={exportGroup.key+'|'+venue} group={exportGroup} venue={venue} count={data.groups[exportGroup.key].emails} close={()=>setExportGroup(null)}/>}
 </section>;
}

function ConsentExport({group,venue,count,close}:{group:Group;venue:string;count:number;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const previous=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{dialog.current?.close();previous?.focus();};},[]);
 async function download(format:string){
  setBusy(true);setError('');setMessage('');
  try{
   const params=new URLSearchParams({kind:'consent','consent-group':group.key,venue,format}),response=await fetch('/marketingdata/api/sevenrooms-export?'+params,{cache:'no-store',signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw new Error((await response.json() as {error?:string}).error||'Could not export this consent group.');
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='ysabel-email-consent-'+group.key+'.'+format;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('The complete consent group is ready.');
  }catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="sr-copy-dialog sr-consent-dialog" aria-label="Export email consent group" onCancel={()=>!busy&&close()}>
  <header><div><span className="sr-copy-eyebrow">SEVENROOMS / EMAIL CONSENT</span><h2>{group.title}</h2></div><button disabled={busy} aria-label="Close consent export" onClick={close}><X size={19}/></button></header>
  <AdminGate title="Export email consent group"><div className="sr-copy-content"><div className="sr-copy-total"><strong>{count.toLocaleString('en')}</strong><span>Unique emails</span></div><p className="sr-copy-note">{group.key==='yes'?'Consented addresses, checked across all profiles.':'Internal consent register. These addresses are not eligible for marketing communication.'}</p><p className="sr-copy-note">Includes email, guest names, consent group, profile count, last visit and recorded venues.</p>
   <div className="sr-consent-downloads">{['csv','xlsx'].map(format=><button className="sr-primary" disabled={busy||!count} key={format} onClick={()=>download(format)}><ArrowDownToLine size={15}/>{busy?'Preparing…':'Download '+format.toUpperCase()}</button>)}{group.key==='yes'&&<CopyEmailsButton query={new URLSearchParams({context:'audience',venue,rules:JSON.stringify([{field:'email-consent',value:'yes'}])}).toString()} title="Yes · subscribed" disabled={busy}/>}</div>
   {error&&<p className="sr-error" role="alert">{error}</p>}{message&&<p role="status" className="sr-copy-message">{message}</p>}
  </div></AdminGate>
 </dialog>;
}
