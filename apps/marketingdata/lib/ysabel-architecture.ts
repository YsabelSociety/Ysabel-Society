import type * as Three from 'three';
// Original Maison Ysabel geometry with physically lit architectural materials.
const centerColors = { garden: { accent: '#8bb5a4' }, asian: { accent: '#d89695' }, italian: { accent: '#dec586' } };

/** Photo reconstruction, in relative units. No building dimensions encode business metrics. */
export function buildYsabelArchitecture(T:typeof Three){
 const groups=new Map<string,Three.Group>(['base','italian','asian','garden'].map(id=>[id,new T.Group()]));
 const materials:Three.MeshStandardMaterial[]=[],textures:Three.Texture[]=[],picks:Three.Mesh[]=[];
 const palette:Record<string,string>={garden:centerColors.garden.accent,asian:centerColors.asian.accent,italian:centerColors.italian.accent};
 const mat=(color:string,metalness=.1,roughness=.65,zone='base')=>{
  const m=new T.MeshStandardMaterial({color,metalness,roughness});m.userData={zone,base:new T.Color(color)};materials.push(m);return m;
 };
 // Shared fine-grain mineral relief keeps the facade tactile without external texture downloads.
 const stoneCanvas=document.createElement('canvas');stoneCanvas.width=stoneCanvas.height=256;
 const ctx=stoneCanvas.getContext('2d')!,pixels=ctx.createImageData(256,256);
 for(let i=0;i<256*256;i++){const x=i%256,y=i>>8,n=164+((i*73+y*31)%29)+Math.sin(x*.14+y*.035)*5;pixels.data.set([n,n,n,255],i*4);}ctx.putImageData(pixels,0,0);
 const stoneTexture=new T.CanvasTexture(stoneCanvas);stoneTexture.wrapS=stoneTexture.wrapT=T.RepeatWrapping;stoneTexture.repeat.set(3,10);stoneTexture.anisotropy=4;textures.push(stoneTexture);
 const stone=mat('#515d60',.08,.78);stone.bumpMap=stoneTexture;stone.bumpScale=.018;
 const edge=mat('#384447',.72,.3),slab=mat('#959f9c',.18,.62),dark=mat('#172529',.12,.65);
 // Glazing combines changing environmental reflections with quiet interior depth.
 const paneCanvas=document.createElement('canvas');paneCanvas.width=128;paneCanvas.height=256;
 const pane=paneCanvas.getContext('2d')!,paneLight=pane.createLinearGradient(0,0,128,256);
 paneLight.addColorStop(0,'#d0dce0');paneLight.addColorStop(.45,'#7e969e');paneLight.addColorStop(1,'#344c56');
 pane.fillStyle=paneLight;pane.fillRect(0,0,128,256);
 pane.fillStyle='#e3ddd02b';pane.fillRect(12,25,36,155);pane.fillStyle='#152a3840';pane.fillRect(54,12,5,230);
 pane.fillStyle='#dce5dd2b';for(let y=26;y<205;y+=17)pane.fillRect(12,y,100,2);
 const paneTexture=new T.CanvasTexture(paneCanvas);paneTexture.colorSpace=T.SRGBColorSpace;paneTexture.anisotropy=4;textures.push(paneTexture);
 const glazing=(color:string,warm=false)=>{const m=new T.MeshPhysicalMaterial({color,map:paneTexture,metalness:.28,roughness:.2,clearcoat:.9,clearcoatRoughness:.13,envMapIntensity:1.35});m.userData={zone:'base',base:new T.Color(color),nightWindow:warm};if(warm){m.emissive.set('#dfb675');m.emissiveIntensity=.1;}materials.push(m);return m;};
 const glass=glazing('#b7cbd2'),warmGlass=glazing('#e1d5b8',true);
 const silver=mat('#b8c0bb',.85,.24),soil=mat('#50574c',.05,.85),leaf=mat('#486142',.02,.94),trunk=mat('#6b5f50');
 const zoneStone=new Map(Object.entries(palette).map(([id,c])=>{const m=mat(new T.Color(c).multiplyScalar(.74).getStyle(),.12,.68,id);m.bumpMap=stoneTexture;m.bumpScale=.012;return [id,m] as const;}));
 const boxGeometry=new T.BoxGeometry(1,1,1);
 const instances=new Map<string,{material:Three.Material;zone:string;values:number[][]}>();
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:Three.Material=stone,zone='base'){
  const key=m.uuid+zone;if(!instances.has(key))instances.set(key,{material:m,zone,values:[]});instances.get(key)!.values.push([w,h,d,x,y,z]);
 }
 function zoneAt(y:number){return y>=27.6?'garden':y>=25.4?'asian':y>=23.2?'italian':'base';}
 // Tall primary volume, attached stepped wing, and continuous entrance podium.
 box(9.9,2.9,15.3,0,1.55,2,stone);box(10.6,.24,16,0,.12,2,slab);
 for(const [lo,hi,id] of [[3,23.2,'base'],[23.2,25.4,'italian'],[25.4,27.6,'asian']] as const)
  box(8.8,hi-lo,6.6,0,(lo+hi)/2,-1.7,id==='base'?stone:zoneStone.get(id)!,id);
 box(8.8,17.7,7.4,0,11.85,5.3,stone);
 // Instanced glazing and stone ribs keep the complete facade inexpensive to draw.
 for(let floor=0;floor<21;floor++){
  const y=3.48+floor*1.12,id=zoneAt(y),facade=id==='base'?stone:zoneStone.get(id)!;
  for(let col=0;col<6;col++){
   const z=-4.48+col*1.06,m=(floor*7+col*13)%19===0?warmGlass:glass;
   for(const side of [-1,1]){box(.045,.81,.61,side*4.415,y,z,m,id);box(.07,.055,.64,side*4.445,y-.41,z,edge,id);}
  }
  for(let col=0;col<8;col++){const x=-3.84+col*1.1;box(.61,.81,.045,x,y,-5.02,(floor+col*3)%23===0?warmGlass:glass,id);}
  // Occasional deeper horizontal stone bands, as in the supplied elevations.
  if(floor%4===0)box(8.9,.12,6.7,0,y-.52,-1.7,facade,id);
 }
 // Lower wing: balconies, recessed terraces, glass balustrades and dark structural piers.
 for(let floor=0;floor<16;floor++){
  const y=3.45+floor*1.08;
  for(let col=0;col<7;col++){
   const x=-3.8+col*1.27,voidBay=(floor===6||floor===11)&&(col===2||col===3);
   box(.91,.79,.055,x,y,9.015,voidBay?dark:(floor+col)%17===0?warmGlass:glass);
   if(voidBay){box(1.05,.08,.38,x,y-.4,9.13,slab);box(1,.24,.025,x,y-.21,9.29,glass);}
  }
  for(let col=0;col<6;col++)for(const side of [-1,1]){
   const z=2.18+col*1.19,isBalcony=(floor===5||floor===10)&&col>2&&col<5;
   box(.045,.77,.78,side*4.42,y,z,isBalcony?dark:glass);
   if(isBalcony){box(.4,.08,.91,side*4.5,y-.4,z,slab);box(.035,.28,.86,side*4.69,y-.19,z,glass);}
  }
  if(floor%3===0)box(8.92,.12,7.5,0,y-.48,5.3,edge);
 }
 // Ground-level colonnade; no signage or text copied from reference photos.
 for(let i=0;i<11;i++){const z=-4.7+i*1.35;for(const side of [-1,1]){box(.065,2.24,.88,side*4.97,1.56,z,glass);box(.21,2.55,.18,side*5.06,1.56,z,edge);}}
 for(let i=0;i<8;i++)box(.92,2.2,.06,-4.2+i*1.2,1.52,9.68,glass);
 box(4.3,.14,1.8,0,2.85,10.1,edge);
 // Continuous rooftop terrace and the lower glazed pavilion are above the wing, not at ground level.
 box(9.28,.22,7.8,0,20.78,5.32,slab);
 const railGlass=new T.MeshPhysicalMaterial({color:'#a4c4cc',transparent:true,opacity:.36,metalness:.2,roughness:.12,depthWrite:false});
 function railing(x:number,z:number,w:number,d:number,y:number){
  box(w,.43,d,x,y+.3,z,railGlass);box(w+.035,.025,d+.025,x,y+.53,z,silver);
  const count=Math.ceil(Math.max(w,d)/.72);for(let i=0;i<=count;i++)box(.025,.56,.025,x+(w>d?(i/count-.5)*w:0),y+.28,z+(d>w?(i/count-.5)*d:0),silver);
 }
 railing(0,9.19,9.2,.025,20.9);railing(-4.59,5.3,.025,7.75,20.9);railing(4.59,5.3,.025,7.75,20.9);
 // Batch all glazing triangles by venue, preserving surface normals and venue color identity.
 const panels=new Map<string,{position:number[];color:number[];lines:number[]}>();
 function triangle(a:number[],b:number[],c:number[],zone:string,seed:number){
  if(!panels.has(zone))panels.set(zone,{position:[],color:[],lines:[]});const data=panels.get(zone)!;
  data.position.push(...a,...b,...c);data.lines.push(...a,...b,...b,...c,...c,...a);
  const color=new T.Color('#ffffff').multiplyScalar(.95+((seed*17)%11)/220);
  for(let i=0;i<3;i++)data.color.push(color.r,color.g,color.b);
 }
 function surface(fn:(u:number,v:number)=>number[],nu:number,nv:number,zone:(v:number)=>string){
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
   const a=fn(i/nu,j/nv),b=fn((i+1)/nu,j/nv),c=fn((i+1)/nu,(j+1)/nv),d=fn(i/nu,(j+1)/nv),id=zone((j+.5)/nv),s=i+j*nu;
   if((i+j)%2){triangle(a,b,d,id,s);triangle(b,c,d,id,s+4);}else{triangle(a,b,c,id,s);triangle(a,c,d,id,s+4);}
  }
 }
 // Upper barrel roof. Its front edge folds down into the concave hourglass facade.
 const crown=(u:number,v:number)=>{const theta=u*Math.PI;return [-4.4+u*8.8,27.6+(1.65+.85*v)*Math.sin(theta),-5+v*6.6+.58*Math.sin(theta)*Math.pow(v,4)];};
 surface(crown,20,14,()=> 'garden');
 surface((u,v)=>[-4.4+u*8.8,27.6+1.65*Math.sin(u*Math.PI)*v,-5],20,5,()=> 'garden');
 const ribbon=(u:number,v:number)=>{
  // The crown, curved facade and lower pavilion share the same central axis.
  const y=20.96+v*6.64,width=8.8-4.1*Math.sin(Math.PI*v),center=0;
  return [center+(u-.5)*width,y,1.66+2.5*Math.pow(1-v,3)+.58*Math.sin(u*Math.PI)];
 };
 // Separate bands exactly at the user-designated floor boundaries, so an exploded view stays coherent.
 for(const [lo,hi,id] of [[0,(23.2-20.96)/6.64,'base'],[(23.2-20.96)/6.64,(25.4-20.96)/6.64,'italian'],[(25.4-20.96)/6.64,1,'asian']] as const)
  surface((u,v)=>ribbon(u,lo+(hi-lo)*v),20,6,()=>id);
 surface((u,v)=>[-4.4+u*8.8,27.6+2.5*Math.sin(u*Math.PI)*v,1.66+.58*Math.sin(u*Math.PI)],20,6,()=> 'garden');
 const pavilion=(u:number,v:number)=>[-4.18+u*8.36,20.98+(1.75-.4*v)*Math.sin(Math.PI*u),1.9+v*6.8];
 surface(pavilion,20,12,()=> 'base');
 surface((u,v)=>[-4.18+u*8.36,20.98+1.35*Math.sin(u*Math.PI)*v,8.7],20,4,()=> 'base');
 for(const [id,data] of panels){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.position,3));geometry.setAttribute('color',new T.Float32BufferAttribute(data.color,3));
  // Smooth the original curved surfaces; isolated triangle normals made the glass look faceted.
  const normalSums=new Map<string,Three.Vector3>(),normalKeys:string[]=[],va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3();
  const vertexKey=(x:number,y:number,z:number)=>`${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
  for(let i=0;i<data.position.length;i+=9){va.fromArray(data.position,i);vb.fromArray(data.position,i+3);vc.fromArray(data.position,i+6);const normal=vb.sub(va).cross(vc.sub(va));for(let j=0;j<9;j+=3){const key=vertexKey(data.position[i+j],data.position[i+j+1],data.position[i+j+2]);normalKeys.push(key);if(!normalSums.has(key))normalSums.set(key,new T.Vector3());normalSums.get(key)!.add(normal);}}
  normalSums.forEach(n=>n.normalize());geometry.setAttribute('normal',new T.Float32BufferAttribute(normalKeys.flatMap(key=>normalSums.get(key)!.toArray()),3));
  const color=id==='base'?'#9cb6bd':new T.Color('#c2d0ce').lerp(new T.Color(palette[id]),.36).getStyle();
  const m=new T.MeshPhysicalMaterial({color,vertexColors:true,metalness:.32,roughness:.19,clearcoat:.95,clearcoatRoughness:.12,side:T.DoubleSide,envMapIntensity:1.3});m.userData={zone:id,base:new T.Color(color)};materials.push(m);
  const mesh=new T.Mesh(geometry,m);mesh.userData.zone=id;mesh.castShadow=true;mesh.receiveShadow=true;groups.get(id)!.add(mesh);picks.push(mesh);
  // Actual slender metal mullions catch highlights, replacing the heavy dark wireframe.
  const edges=new Map<string,number[]>();for(let i=0;i<data.lines.length;i+=6){const a=data.lines.slice(i,i+3),b=data.lines.slice(i+3,i+6),ka=vertexKey(...a as [number,number,number]),kb=vertexKey(...b as [number,number,number]);if(ka!==kb)edges.set([ka,kb].sort().join('|'),[...a,...b]);}
  const frameGeometry=new T.CylinderGeometry(1,1,1,5,1,true),frameMaterial=mat('#8fa09f',.82,.3,id);frameMaterial.userData.gardenRoofFrame=id==='garden';
  const frames=new T.InstancedMesh(frameGeometry,frameMaterial,edges.size),matrix=new T.Matrix4(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0);let frameIndex=0;
  for(const values of edges.values()){va.fromArray(values,0);vb.fromArray(values,3);vc.subVectors(vb,va);const length=vc.length();rotation.setFromUnitVectors(up,vc.normalize());matrix.compose(va.add(vb).multiplyScalar(.5),rotation,new T.Vector3(.012,length,.012));frames.setMatrixAt(frameIndex++,matrix);}
  frames.instanceMatrix.needsUpdate=true;groups.get(id)!.add(frames);
 }
 // Narrow colored seams identify venues without painting the entire hotel facade.
 for(const [y,id] of [[23.2,'italian'],[25.4,'asian'],[27.6,'garden']] as const){const seam=mat(palette[id],.6,.3,id);box(8.87,.055,6.67,0,y,-1.7,seam,id);}
 box(.028,1.9,.028,1.2,30.22,-1.9,silver,'garden');
 // Planters on real visible terrace edges; other buildings in the photos are intentionally excluded.
 const foliageGeometry=new T.IcosahedronGeometry(.26,2),foliage:Three.Matrix4[]=[];
 function plant(x:number,z:number,y:number,size=1){
  box(.5,.35,.5,x,y+.17,z,soil);box(.06,.55,.06,x,y+.57,z,trunk);
  for(let i=0;i<3;i++)foliage.push(new T.Matrix4().compose(new T.Vector3(x+(i===1?.17:i===2?-.17:0)*size,y+(.72+i*.14)*size,z),new T.Quaternion(),new T.Vector3(size,size*1.5,size)));
 }
 for(let i=0;i<8;i++)plant(-4.26,2.45+i*.83,20.91,.68);
 for(let i=0;i<5;i++)plant(-3.4+i*1.7,9.01,20.91,.63);
 for(let i=0;i<7;i++)plant(-5.55,-3.8+i*2,.22,1.25);
 const trees=new T.InstancedMesh(foliageGeometry,leaf,foliage.length);foliage.forEach((m,i)=>trees.setMatrixAt(i,m));trees.instanceMatrix.needsUpdate=true;trees.castShadow=true;trees.receiveShadow=true;groups.get('base')!.add(trees);
 for(const {material:m,zone,values} of instances.values()){
  const mesh=new T.InstancedMesh(boxGeometry,m,values.length),matrix=new T.Matrix4();
  values.forEach(([w,h,d,x,y,z],i)=>{matrix.makeScale(w,h,d);matrix.setPosition(x,y,z);mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.userData.zone=zone;mesh.userData.gardenAntenna=zone==='garden'&&m===silver;mesh.castShadow=true;mesh.receiveShadow=true;groups.get(zone)!.add(mesh);picks.push(mesh);
 }
 return {groups,materials,textures,picks};
}
