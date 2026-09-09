'use client';
import { useEffect, useRef } from 'react';

// Decorative connection between the three editorial signals, not a metric scale.
export function IntelligenceScene({ active }: { active: number }) {
  const host = useRef<HTMLDivElement>(null);
  const selected = useRef(active);
  selected.current = active;
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    const desktop = matchMedia('(min-width: 1024px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let disposeScene: (() => void) | undefined;
    let generation = 0;
    const setup = async () => {
      const current = ++generation;
      disposeScene?.(); disposeScene = undefined;
      if (!desktop.matches) return;
      const THREE = await import('three');
      if (current !== generation) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'}); } catch { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
      target.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38,1,0.1,30); camera.position.z=7;
      const group = new THREE.Group(); scene.add(group);
      const colors = [0xb470a6,0x4d9396,0x79997a];
      const geometry = new THREE.TorusGeometry(1.25,0.025,8,100);
      const rings = colors.map((color,i) => {
        const material = new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.55});
        const mesh = new THREE.Mesh(geometry,material);
        mesh.rotation.set(i*.65,.55+i*.7,i*.4); group.add(mesh);return mesh;
      });
      const sphere = new THREE.SphereGeometry(.105,16,12);
      const nodes = colors.map(color => {const mesh = new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color}));group.add(mesh);return mesh;});
      const pointer = {x:0,y:0};
      let frame=0,near=false,last=0,time=0;
      const draw = (now:number) => {
        frame=0;
        if (!near || document.hidden) return;
        if(now-last>=33){time+=Math.min((now-last)/1000,.04);last=now;
          group.rotation.y += (pointer.x*.35-group.rotation.y)*.06;
          group.rotation.x += (pointer.y*.25-group.rotation.x)*.06;
          rings.forEach((ring,i)=>{if(!reduced.matches)ring.rotation.z+=.003*(i+1);ring.material.opacity+=( (selected.current===i?.95:.3)-ring.material.opacity)*.08;});
          nodes.forEach((node,i)=>{const t=(reduced.matches?0:time*.3)+i*Math.PI*2/3;node.position.set(Math.cos(t)*1.25,Math.sin(t)*1.1,Math.sin(t+i)*.55);node.scale.setScalar(selected.current===i?1.5:1);});
          renderer.render(scene,camera);
        }
        frame=requestAnimationFrame(draw);
      };
      const start=()=>{if(near&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);};
      const observer=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;if(near)start();else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'80px'});observer.observe(target);
      const resize=new ResizeObserver(()=>{const {width,height}=target.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(target);
      const move=(e:PointerEvent)=>{const r=target.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=(e.clientY-r.top)/r.height*2-1;};
      const leave=()=>{pointer.x=pointer.y=0;};
      const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();};
      target.addEventListener('pointermove',move);target.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);
      disposeScene=()=>{cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();target.removeEventListener('pointermove',move);target.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);geometry.dispose();sphere.dispose();rings.forEach(m=>m.material.dispose());nodes.forEach(m=>m.material.dispose());renderer.dispose();renderer.domElement.remove();};
    };
    const change=()=>{void setup().catch(()=>{});};change();desktop.addEventListener('change',change);
    return()=>{generation++;desktop.removeEventListener('change',change);disposeScene?.();};
  },[]);
  return <div className="intelligence-art" aria-hidden="true"><div ref={host} className="intelligence-canvas"/><div className="intelligence-art-caption">{['Momentum','Channel spotlight','Beyond social'][active]}<span>Connected perspectives</span></div></div>;
}
