import ExcelJS from 'exceljs';
export const runtime='nodejs';export const maxDuration=60;
const safe=(v:unknown)=>{const s=String(v??'');return /^[=+\-@\t\r]/.test(s)?"'"+s:s;};
export async function GET(req:Request){try{
 const q=new URL(req.url).searchParams,format=q.get('format')||'csv',scope=q.get('scope')||'email';
 const cookie=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>/^ys_marketing_(session|admin)=/.test(x)).join('; ');
 const rows:Record<string,string|number>[]=[];q.set('op',q.get('kind')?'crm-export':'export');
 for(let page=1;page<=100;page++){q.set('page',String(page));const r=await fetch('https://ysabel-society-intelligence.arberhalili1.chatgpt.site/marketingdata/api/sevenrooms?'+q,{headers:{cookie},cache:'no-store',signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Export unavailable.');rows.push(...d.rows);if(d.rows.length<1000)break;}
 const fields=q.get('kind')==='reservations'?['date','time','name','email','phone','consent','venue','covers','status','status_original','external_id']:q.get('kind')==='guests'?['name','email','phone','consent','visits','last_visit','preferred_venue','birthday','external_id']:scope==='email'?['email']:scope==='name'?['name','email']:['name','email','phone','birthday','visits','last_visit','preferred_venue'];
 if(format==='copy'&&!q.get('kind'))return Response.json({emails:rows.map(r=>r.email)},{headers:{'Cache-Control':'private, no-store'}});
 if(format==='xlsx'){const w=new ExcelJS.Workbook();const s=w.addWorksheet('Marketing audience');s.columns=fields.map(key=>({header:key.replaceAll('_',' '),key,width:key==='email'?36:24}));for(const r of rows)s.addRow(Object.fromEntries(fields.map(k=>[k,safe(r[k])])));s.getRow(1).font={bold:true,color:{argb:'FF1D3428'}};s.views=[{state:'frozen',ySplit:1}];return new Response(await w.xlsx.writeBuffer() as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="ysabel-audience-export.xlsx"','Cache-Control':'private, no-store'}});}
 const csv='\uFEFF'+[fields,...rows.map(r=>fields.map(k=>safe(r[k])))].map(r=>r.map(s=>'"'+String(s).replaceAll('"','""')+'"').join(',')).join('\r\n');return new Response(csv,{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="ysabel-audience-export.csv"','Cache-Control':'private, no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Export unavailable.'},{status:400});}}


