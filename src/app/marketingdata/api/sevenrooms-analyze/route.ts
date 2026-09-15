import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';
const parsedCache=new Map<string,{rows:Record<string,unknown>[];summary:Record<string,unknown>;expires:number}>();
import {normalize,clientColumns,reservationColumns} from '@/lib/sevenrooms-normalize';
type Normalized = ReturnType<typeof normalize> & Partial<{venue:string;source_venue:string;date:string;status:string;source_visits:number}>;
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){try{
 const origin=req.headers.get('origin')||'';if(!['https://ysabelsociety.com','https://www.ysabelsociety.com'].includes(origin)&&process.env.NODE_ENV==='production')return Response.json({error:'Invalid origin'},{status:403});
 const {id,kind,mapping={},fromBatch=0}=await req.json();if(!Number.isInteger(fromBatch)||fromBatch<0||fromBatch>5000)throw new Error("Invalid analysis step.");if(!/^[\w-]{20,80}$/.test(id)||!['clients','reservations'].includes(kind))throw new Error('Choose an uploaded file.');
 const cookie=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>/^ys_marketing_(session|admin)=/.test(x)).join('; ');
 const url='https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/sevenrooms';
 const headers={cookie,origin,'Content-Type':'application/json'};
 const call=async(body:unknown)=>{for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Import staging failed.');return data;}catch(e){if(attempt===1)throw e;await new Promise(resolve=>setTimeout(resolve,500));}}};
 // Recheck the administrator session on every request, including warm-cache hits.
 const access=await fetch(url+'?op=imports',{headers:{cookie},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!access.ok)return Response.json({error:'Unlock administrator access before importing.'},{status:403});
 const key=createHash('sha256').update(cookie+id+JSON.stringify(mapping)).digest('hex');for(const [k,v] of parsedCache)if(v.expires<Date.now())parsedCache.delete(k);let cached=parsedCache.get(key);
 if(!cached){
 const raw=await fetch(url+'?op=raw&id='+encodeURIComponent(id),{headers:{cookie},cache:'no-store',signal:AbortSignal.timeout(25000)});if(!raw.ok)throw new Error('Unlock administrator access before importing.');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await raw.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
 const sheet=workbook.worksheets[0];if(!sheet)throw new Error('No worksheet found.');
 const scalar=(v:ExcelJS.CellValue):unknown=>v instanceof Date?v.toISOString():v&&typeof v==='object'?('result' in v?v.result:'text' in v?v.text:'richText' in v?v.richText.map(x=>x.text).join(''):''):v??'';
 const headersRaw=(sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(x=>String(scalar(x)).trim());
 const heads=headersRaw.map(h=>mapping[h]||h);
 const needed=kind==='clients'?['Full Name','Guest ID']:['Reservation Date','Full Name (Reservation)','Venue Name'];
 const missing=needed.filter(h=>!heads.includes(h));if(missing.length)return Response.json({error:'Some required columns could not be recognised.',missing,columns:headersRaw},{status:400});
 const rows:Record<string,unknown>[]=[];sheet.eachRow((row,i)=>{if(i===1)return;const r:Record<string,unknown>={};heads.forEach((h,j)=>{r[h]=scalar(row.getCell(j+1).value);});rows.push(r);});
 if(rows.length>100000)throw new Error('Import up to 100,000 rows per file.');
 const venues:Record<string,number>={},statuses:Record<string,number>={},emailCounts=new Map<string,number>(),ids=new Set<string>(),dates:string[]=[];let eligible=0,duplicateIDs=0,missingIDs=0;
 for(const raw of rows){const r:Normalized=normalize(raw,kind);const v=r.venue||r.source_venue;if(v)venues[v]=(venues[v]||0)+1;if(r.date)dates.push(r.date);if(r.status)statuses[r.status]=(statuses[r.status]||0)+1;if(!r.external_id)missingIDs++;else if(ids.has(r.external_id))duplicateIDs++;else ids.add(r.external_id);if(r.email&&r.consent==='yes'){eligible++;emailCounts.set(r.email,(emailCounts.get(r.email)||0)+1);}}
 dates.sort();const summary={venues,statuses,eligibleProfiles:eligible,uniqueEligibleEmails:emailCounts.size,duplicateIDs,missingIDs,start:dates[0]||'',end:dates.at(-1)||'',unknownColumns:headersRaw.filter(h=>h&&!(kind==='clients'?clientColumns:reservationColumns).includes(h)),preview:rows.slice(0,10).map(raw=>{const r:Normalized=normalize(raw,kind);return {name:r.name,email:r.email,venue:r.venue||r.source_venue,visits:r.source_visits,date:r.date,status:r.status,consent:r.consent};})};
 if(parsedCache.size>=2)parsedCache.clear();cached={rows,summary,expires:Date.now()+120000};parsedCache.set(key,cached);
 }
 const {rows,summary}=cached;cached.expires=Date.now()+120000;
 let next=fromBatch;const batches=Math.ceil(rows.length/200),nextBatch=Math.min(batches,fromBatch+8);await Promise.all(Array.from({length:4},async()=>{while(next<nextBatch){const batch=next++;await call({op:'stage',id,batch,rows:rows.slice(batch*200,(batch+1)*200)});}}));
 if(nextBatch===batches)await call({op:'analyzed',id,rows:rows.length,batches,summary});return Response.json({id,rows:rows.length,batches,nextBatch,summary},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'The file could not be analyzed.'},{status:400,headers:{'Cache-Control':'private, no-store'}});}}



