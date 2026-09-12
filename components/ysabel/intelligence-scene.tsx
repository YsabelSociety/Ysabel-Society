'use client';
import { useEffect, useRef } from 'react';
import { appPath } from '@/lib/app-path';
import { canvasPixelRatio, releaseRenderer } from '@/lib/render-budget';
// Public, immutable artwork only. Reuse the four triangulations across visits;
// GPU buffers and contexts are still released each time the scene is hidden.
let artwork: Promise<[typeof import('three'), typeof import('three/examples/jsm/loaders/SVGLoader.js'), string[]]> | undefined;
const geometryCache: import('three').ExtrudeGeometry[] = [];
function loadArtwork() {
  if (!artwork) artwork = Promise.all([
    import('three'), import('three/examples/jsm/loaders/SVGLoader.js'),
    Promise.all([0,1,2,3].map(i => fetch(appPath(`/emblem-vector-${i}.svg`), {signal: AbortSignal.timeout(15000)}).then(r => {
      if (!r.ok) throw new Error('Emblem unavailable');
      return r.text();
    }))),
  ]).catch(error => { artwork = undefined; throw error; });
  return artwork;
}
// Decorative connection between the three editorial signals, not a metric scale.
export function IntelligenceScene({ active, signals }: { active: number; signals: {title:string;value:string;detail:string}[] }) {
  const host = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  const selected = useRef(active);
  selected.current = active;
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    const desktop = matchMedia('(min-width: 1024px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const touch = matchMedia('(pointer: coarse)');
    let disposeScene: (() => void) | undefined;
    let generation = 0;
    const setup = async () => {
      const current = ++generation;
      disposeScene?.(); disposeScene = undefined;
      if (!desktop.matches) return;
      const [THREE, {SVGLoader}, vectors] = await loadArtwork();
      if (current !== generation) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'}); } catch { return; }
      renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2));
      const resources: {dispose():void}[] = [];
      let cleanupRuntime = () => {};
      disposeScene = () => { cleanupRuntime(); resources.forEach(r => r.dispose()); releaseRenderer(renderer); };
      target.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38,1,0.1,30); camera.position.z=7;
      const group = new THREE.Group(); scene.add(group); group.scale.setScalar(.8);

      const palette=[new THREE.Color('#eac426'),new THREE.Color('#1d3428'),new THREE.Color('#cd061e'),new THREE.Color('#bdbdb9')];
      scene.add(new THREE.HemisphereLight(0xffffff,0x526354,2.2));
      const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(-3,5,7);scene.add(key);
      const rim=new THREE.DirectionalLight(0xffffff,1.3);rim.position.set(4,-1,3);scene.add(rim);
      const logos: import('three').Mesh<import('three').ExtrudeGeometry, import('three').MeshPhysicalMaterial>[] = [];
      for (let i=0; i<vectors.length; i++) {
        // Give input and navigation a turn between the expensive vector shapes.
        await new Promise(resolve => setTimeout(resolve, 0));
        if (current !== generation) return;
        let geometry=geometryCache[i];
        if (!geometry) {
          const shapes=new SVGLoader().parse(vectors[i]).paths.flatMap(path=>SVGLoader.createShapes(path));
          geometry=new THREE.ExtrudeGeometry(shapes,{depth:8,steps:1,bevelEnabled:true,bevelThickness:.5,bevelSize:.25,bevelSegments:2,curveSegments:8});
          geometry.center();geometry.rotateX(Math.PI);geometry.computeBoundingBox();
          const size=geometry.boundingBox!.getSize(new THREE.Vector3());
          const scale=4.4/Math.max(size.x,size.y);geometry.scale(scale,scale,scale);
          geometryCache[i]=geometry;
        }
        resources.push(geometry);
        const material=new THREE.MeshPhysicalMaterial({color:palette[i],metalness:.22,roughness:.36,clearcoat:.2,transparent:true,opacity:i===0?1:0,depthWrite:true});
        resources.push(material);
        const mesh=new THREE.Mesh(geometry,material);mesh.visible=i===0;group.add(mesh);logos.push(mesh);
      }
      const tint=palette[0].clone();
      const point = new THREE.Vector3();
      let width = 0, height = 0;
      const pointer = {x:0,y:0};
      let frame=0,near=false,last=0,time=0,lost=false;
      const draw = (now:number) => {
        frame=0;
        if (lost || !near || document.hidden) return;
        if(document.documentElement.dataset.scrolling === 'true') { last=now; frame=requestAnimationFrame(draw); return; }
        if(now-last>=32){time+=Math.min((now-last)/1000,.1);last=now;
          group.rotation.y += (pointer.x*.35+(reduced.matches?0:Math.sin(time*.4)*.22)-group.rotation.y)*.06;
          group.rotation.x += (pointer.y*.25+(reduced.matches?0:Math.cos(time*.3)*.12)-group.rotation.x)*.06;
          group.position.y=reduced.matches?0:Math.sin(time*.65)*.065;
          
          const phase=reduced.matches?0:time/7;
          const index=Math.floor(phase)%4;
          const transition=Math.max(0,Math.min(1,((phase%1)-.5)*2));
          const eased=transition*transition*transition*(transition*(transition*6-15)+10);
          tint.copy(palette[index]).lerp(palette[(index+1)%4],eased);
          logos.forEach((logo,i)=>{
            const incoming=i===(index+1)%4;
            const opacity=i===index?1-eased:incoming?eased:0;
            logo.visible=opacity>.001;logo.material.opacity=opacity;
            logo.material.depthWrite=opacity>.98;
            logo.scale.setScalar(i===index?1-eased*.06:1.06-eased*.06);
            logo.rotation.z=(reduced.matches?0:Math.sin(time*.18)*.12)+(incoming?(1-eased)*.12:-eased*.12);
            logo.position.z=incoming?.015:0;
          });
          target.dataset.emblemShape=String(index);target.dataset.emblemBlend=eased.toFixed(3);
          group.updateMatrixWorld(true);
          cards.current.forEach((card,i)=>{
            if(!card)return;
            const count=36;
            const angle=i*2.39996+(reduced.matches?0:time*.055);
            const radius=1.75*Math.sqrt((i+.5)/count);
            point.set(Math.cos(angle)*radius,Math.sin(angle)*radius,.28+Math.sin(i*1.7+(reduced.matches?0:time*.5))*.14);
            point.applyMatrix4(group.matrixWorld).project(camera);
            card.style.left=((point.x+1)*width/2)+'px';card.style.top=((-point.y+1)*height/2)+'px';
            card.style.transform='translate(-50%,-50%) perspective(600px) rotateY('+(group.rotation.y*25)+'deg) rotateX('+(-group.rotation.x*25)+'deg) rotate('+Math.sin(i*1.5+(reduced.matches?0:time*.3))*4+'deg)';
            // Exchange each digit while invisible, synchronized with the shape blend.
            const change=Math.max(0,Math.min(1,(eased-i/count*.16)/.84));
            const veil=Math.pow(Math.abs(2*change-1),.65);
            card.style.opacity=String((.32+.3*(.5+.5*Math.sin(i+time*.6)))*veil);
            card.style.translate='0 '+(-Math.sin(change*Math.PI)*8)+'px';
            const digitShape=(index+(change>=.5?1:0))%4;
            card.textContent=String((i*7+digitShape*3)%10);
            card.style.color='#'+tint.getHexString();
          });
          renderer.render(scene,camera);
        }
        frame=requestAnimationFrame(draw);
      };
      const start=()=>{if(!lost&&near&&!document.hidden&&!frame){last=performance.now();frame=requestAnimationFrame(draw);}};
      const observer=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;if(near)start();else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'80px'});observer.observe(target);
      const resize=new ResizeObserver(()=>{const bounds=target.getBoundingClientRect();width=bounds.width;height=bounds.height;if(!width||!height)return;renderer.setPixelRatio(canvasPixelRatio(width,height,devicePixelRatio,touch.matches));renderer.setSize(width,height,false);camera.aspect=width/height;camera.position.z=Math.max(7,7/camera.aspect);camera.updateProjectionMatrix();});resize.observe(target);
      const move=(e:PointerEvent)=>{const r=target.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=(e.clientY-r.top)/r.height*2-1;};
      const leave=()=>{pointer.x=pointer.y=0;};
      const contextLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;renderer.domElement.style.visibility='hidden';};
      renderer.domElement.addEventListener('webglcontextlost',contextLost);
      const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();};
      target.addEventListener('pointermove',move);target.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);
      cleanupRuntime=()=>{renderer.domElement.removeEventListener('webglcontextlost',contextLost);cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();target.removeEventListener('pointermove',move);target.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);};
    };
    let inView=false;
    const change=()=>{
      if (!desktop.matches) { generation++; disposeScene?.(); disposeScene=undefined; return; }
      if (!inView || disposeScene) return;
      const pending=setup(),expected=generation;
      void pending.catch(()=>{if(expected===generation){disposeScene?.();disposeScene=undefined;}});
    };
    // Do not download or triangulate the desktop artwork before it is visible.
    const admission=new IntersectionObserver(entries=>{
      inView=entries.some(entry=>entry.isIntersecting);
      if(inView)change();
    },{rootMargin:'80px'});
    admission.observe(target);desktop.addEventListener('change',change);
    return()=>{generation++;admission.disconnect();desktop.removeEventListener('change',change);disposeScene?.();};
  },[]);
  return <div className="intelligence-art" aria-hidden="true"><div ref={host} className="intelligence-canvas">{Array.from({length:36},(_,i)=><div key={i} ref={node=>{cards.current[i]=node;}} className="emblem-digit">{i%2}</div>)}</div><div className="intelligence-caption-stack">{signals.map((signal,i)=><div key={signal.title} className="intelligence-art-caption" data-current={active===i}><span>{signal.title}</span><strong>{signal.value}</strong><span>{signal.detail}</span></div>)}</div></div>;
}
