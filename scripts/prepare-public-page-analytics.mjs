import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const marker='<script defer src="/website-page-analytics.js" data-ysabel-page-analytics></script>';
const roots=[['library/newsletters','Newsletter'],['share','Newsletter'],['email-signatures','Email signature']];
export function preparePublicPageAnalytics(root){
 const pages=[];
 function scan(folder,kind){if(!fs.existsSync(folder))return;for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(entry.isDirectory()){if(!['history','assets','media'].includes(entry.name))scan(path.join(folder,entry.name),kind);continue;}if(entry.name!=='index.html')continue;const file=path.join(folder,entry.name);let html=fs.readFileSync(file,'utf8');const existing=/G-WDV71MP0DK|data-ysabel-page-analytics/.test(html);if(!existing){if(!/<\/head\s*>/i.test(html))throw Error('Missing document head: '+file);html=html.replace(/<\/head\s*>/i,marker+'\n</head>');fs.writeFileSync(file,html);}const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'Published page').replace(/<[^>]+>/g,'').replaceAll('&amp;','&').replace(/\s+/g,' ').trim();pages.push({path:'/'+path.relative(path.join(root,'public'),file).split(path.sep).join('/'),title,kind,trackingEnabled:true});}}
 for(const [folder,kind]of roots)scan(path.join(root,'public',folder),kind);
 pages.sort((a,b)=>a.kind.localeCompare(b.kind)||a.path.localeCompare(b.path));
 const output=path.join(root,'src/data/website-pages.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({measurementId:'G-WDV71MP0DK',pages},null,2)+'\n');return pages;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const pages=preparePublicPageAnalytics(root);console.log('Verified Analytics on '+pages.length+' public landing pages.');}
