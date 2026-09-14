'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Settings } from 'lucide-react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { AdminGate } from './admin-gate';
import type { CommunityRecord } from '@/lib/community';
export function ReviewAI({records,onUpdated}:{records:CommunityRecord[];onUpdated:()=>void}) {
  const [open,setOpen]=useState(false),[key,setKey]=useState(''),[configured,setConfigured]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const running=useRef(false),mounted=useRef(true),blocked=useRef(false);
  useEffect(()=>{mounted.current=true;void fetch('/marketingdata/api/review-ai').then(r=>r.json()).then(d=>{if(mounted.current)setConfigured(d.configured===true);}).catch(()=>{});return()=>{mounted.current=false;};},[]);
  async function analyze(){
    if(running.current)return;running.current=true;setBusy(true);
    try{
      let remaining=1, rounds=0;
      while(remaining>0&&mounted.current){
        const response=await fetch('/marketingdata/api/review-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'analyze'}),signal:AbortSignal.timeout(60000)});
        const d=await response.json();if(!response.ok)throw new Error(d.error||'Review analysis failed.');
        remaining=d.remaining;setMessage(`AI reviewed ${d.total-remaining} of ${d.total} reviews · English translations saved`);
        if(!remaining)onUpdated(); ++rounds;
        if(remaining&&d.completed===0){setMessage('Another session is analyzing reviews. Saved results will appear on refresh.');break;}
      }
    }catch(e){blocked.current=true;setMessage((e as Error).message);if((e as Error).message.includes('key is invalid'))setConfigured(false);onUpdated();}finally{running.current=false;if(mounted.current)setBusy(false);}
  }
  useEffect(()=>{if(configured&&!blocked.current&&records.some(r=>r.source==='gbp'&&r.kind==='review'&&!r.reviewAnalysis))void analyze();},[configured,records]);
  async function save(){
    setBusy(true);try{
      const response=await fetch('/marketingdata/api/review-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'configure',key}),signal:AbortSignal.timeout(40000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Connection failed.');
      setKey('');blocked.current=false;setConfigured(true);setOpen(false);setMessage('OpenAI connected. Reviewing all saved reviews…');void analyze();
    }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  const reviewed=records.filter(r=>r.reviewAnalysis).length;
  return <div className="review-ai-panel">
    <div><strong><Sparkles size={17}/> AI criticism detector</strong><p>{configured?`${reviewed} of ${records.length} reviews analyzed. New or edited reviews are analyzed when this report is opened; saved results are reused.`:'AI is not active. Current results use rule-based detection. Connect a valid OpenAI API key to identify implicit criticism and translate every review, including five-star feedback.'}</p></div>
    <div><button className="secondary" onClick={()=>setOpen(true)}><Settings size={16}/> {configured?'AI settings':'Connect OpenAI'}</button>{configured&&<button className="secondary" disabled={busy} onClick={()=>void analyze()}>{busy?'Analyzing…':'Analyze pending reviews'}</button>}</div>
    {message&&<p role="status">{message}</p>}
    <Dialog open={open} onOpenChange={v=>{setOpen(v);if(!v)setKey('');}}><DialogContent><DialogHeader><DialogTitle>OpenAI review intelligence</DialogTitle><DialogDescription>Translate the original text and identify supported criticism across all star ratings. API usage is billed to your OpenAI account. Only review text and ratings are sent, without reviewer names or photos.</DialogDescription></DialogHeader>
      <AdminGate title="Unlock AI settings"><label htmlFor="review-ai-key">OpenAI API key</label><input id="review-ai-key" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-…"/><p>The key is stored in private server storage and is never returned to the browser. Existing analyses are reused; new or edited reviews are checked automatically while this report is open.</p><button className="primary" disabled={busy||!key} onClick={()=>void save()}>Save key and analyze reviews</button>{message&&<p role="status">{message}</p>}</AdminGate>
    </DialogContent></Dialog>
  </div>;
}

