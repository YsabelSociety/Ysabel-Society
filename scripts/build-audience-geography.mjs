// Public reference geography only. Website audience counts never enter these files.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'apps/marketingdata/public/maps');
const normalize=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
async function read(url,binary=false){const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Reference download failed: '+response.status);return binary?Buffer.from(await response.arrayBuffer()):response.text();}
function unzip(bytes,wanted){for(let offset=0;offset<bytes.length-46;offset++){if(bytes.readUInt32LE(offset)!==0x02014b50)continue;const nameLength=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),name=bytes.subarray(offset+46,offset+46+nameLength).toString();if(name===wanted){const size=bytes.readUInt32LE(offset+20),local=bytes.readUInt32LE(offset+42),start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),data=bytes.subarray(start,start+size);return bytes.readUInt16LE(offset+10)===8?inflateRawSync(data).toString('utf8'):data.toString('utf8');}offset+=45+nameLength+extra+comment;}throw Error('Reference ZIP member missing.');}
const urls={countries:'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',cities:'https://download.geonames.org/export/dump/cities5000.zip',regions:'https://download.geonames.org/export/dump/admin1CodesASCII.txt',names:'https://download.geonames.org/export/dump/countryInfo.txt'};
const [geo,zip,regionsText,countryText]=await Promise.all([read(urls.countries),read(urls.cities,true),read(urls.regions),read(urls.names)]);
const regions=new Map(regionsText.split('\n').filter(Boolean).map(line=>{const row=line.split('\t');return[row[0],[...new Set([row[1],row[2]].filter(Boolean).map(normalize))]];}));
const names=countryText.split('\n').filter(line=>line && !line.startsWith('#')).map(line=>line.split('\t'));
const codes=new Map(names.map(row=>[row[1],row[0]]));
const countryNames=Object.fromEntries(names.map(row=>[row[0],row[4]]));
countryNames.XK='Kosovo';
const raw=JSON.parse(geo);
const round=coordinates=>coordinates.map(value=>Array.isArray(value)?round(value):Math.round(value*10000)/10000);
const features=raw.features.map(feature=>{const p=feature.properties;const code=p.ADMIN==='Kosovo'?'XK':/^[A-Z]{2}$/.test(p.ISO_A2_EH)?p.ISO_A2_EH:codes.get(p.ADM0_A3)||p.ISO_A2;return {type:'Feature',properties:{code,name:countryNames[code]||p.NAME_EN||p.ADMIN},geometry:{type:feature.geometry.type,coordinates:round(feature.geometry.coordinates)}};}).filter(feature=>/^[A-Z]{2}$/.test(feature.properties.code));
const cities=unzip(zip,'cities5000.txt').split('\n').filter(Boolean).map(line=>{const row=line.split('\t');const aliases=[...new Set([row[1],row[2],...row[3].split(',')].filter(value=>/^[\p{L}\s.'’()-]+$/u.test(value)).map(normalize).filter(value=>value.length>1 && value.length<70))].slice(0,24);return [row[0],row[1],row[8],Number(row[4]),Number(row[5]),aliases,regions.get(row[8]+'.'+row[10])||[]];});
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'website-countries.geojson'),JSON.stringify({type:'FeatureCollection',features}));
const grouped=new Map();
for(const city of cities){const list=grouped.get(city[2])||[];list.push(city);grouped.set(city[2],list);}
await fs.mkdir(path.join(output,'website-cities'),{recursive:true});
for(const [code,records] of grouped)await fs.writeFile(path.join(output,'website-cities',code+'.json'),JSON.stringify(records));
await fs.writeFile(path.join(output,'website-cities.json'),JSON.stringify({version:2,columns:['geonameId','name','countryCode','latitude','longitude','normalizedAliases','normalizedRegions'],countries:countryNames,available:[...grouped.keys()].sort()}));
await fs.writeFile(path.join(output,'website-geography-sources.json'),JSON.stringify({retrievedAt:new Date().toISOString(),sources:urls,licenses:{countries:'Natural Earth public domain',cities:'GeoNames CC BY 4.0'},purpose:'Reference country boundaries and approximate city centres. No audience or personal location records.'},null,2));
console.log(JSON.stringify({countries:features.length,cities:cities.length,output}));
