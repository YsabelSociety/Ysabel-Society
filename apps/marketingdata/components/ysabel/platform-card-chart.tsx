'use client';
import { useId, type CSSProperties } from 'react';
export type CardPoint = {date:string;value:number|null};
export function PlatformCardChart({points,color,bars=false,lifetime=false}:{points:CardPoint[];color:string;bars?:boolean;lifetime?:boolean}) {
 const id=useId().replace(/:/g,'');
 const values=points.flatMap(p=>p.value===null?[]:[p.value]);
 const max=Math.max(1,...values);
 const xy=(p:CardPoint,i:number)=>({x:12+i*276/Math.max(1,points.length-1),y:86-(p.value??0)/max*68});
 const segments:{x:number;y:number}[][]=[];
 points.forEach((p,i)=>{if(p.value===null){if(segments.at(-1)?.length)segments.push([]);return;}if(!segments.length)segments.push([]);segments.at(-1)!.push(xy(p,i));});
 const line=(s:{x:number;y:number}[])=>s.map((p,i)=>i?`C ${(s[i-1].x+p.x)/2} ${s[i-1].y}, ${(s[i-1].x+p.x)/2} ${p.y}, ${p.x} ${p.y}`:`M ${p.x} ${p.y}`).join(' ');
 if(!values.length)return <span className="platform-card-chart chart-no-history">No dated trend supplied</span>;
 return <span className="platform-card-chart" style={{'--card-chart-color':color} as CSSProperties}>
  <svg viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label={lifetime?'Lifetime views by publication date':'Reported values by date'}>
   <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".27"/><stop offset="1" stopColor={color} stopOpacity=".015"/></linearGradient><linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".8"/><stop offset="1" stopColor={color} stopOpacity=".12"/></linearGradient></defs>
   {[35,61,87].map(y=><path key={y} d={`M 12 ${y} H 288`} stroke={color} strokeOpacity=".09" vectorEffect="non-scaling-stroke"/>)}
   <g className="platform-chart-reveal">
    {bars?points.map((p,i)=>p.value===null?null:<rect key={p.date} x={xy(p,i).x- Math.min(9,90/points.length)/2} y={xy(p,i).y} width={Math.min(9,90/points.length)} height={Math.max(1,87-xy(p,i).y)} rx="2" fill={`url(#${id}-bar)`}><title>{p.date}: {p.value.toLocaleString()}{lifetime?' lifetime views':''}</title></rect>):segments.filter(s=>s.length).map((s,i)=><path key={i} d={`${line(s)} L ${s.at(-1)!.x} 87 L ${s[0].x} 87 Z`} fill={`url(#${id}-area)`}/>)}
    {segments.filter(s=>s.length>1).map((s,i)=><path key={i} d={line(s)} fill="none" stroke={color} strokeWidth={bars?1.4:2} strokeOpacity={bars?.65:1} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}
    {points.map((p,i)=>p.value===null?null:<g key={p.date} className="platform-chart-point"><circle cx={xy(p,i).x} cy={xy(p,i).y} r="6" fill={color} fillOpacity="0"/><circle className="platform-chart-dot" cx={xy(p,i).x} cy={xy(p,i).y} r="2.6" fill={color}/><title>{p.date}: {p.value.toLocaleString()}{lifetime?' lifetime views':''}</title></g>)}
   </g>
  </svg><span className="platform-chart-caption">{lifetime?'Lifetime views · publication date':values.length===1?'One dated observation':'Daily trend'}<span>{points[0]?.date.slice(5)} — {points.at(-1)?.date.slice(5)}</span></span>
 </span>;
}
