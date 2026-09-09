'use client';
import { useEffect, useRef } from 'react';
import paths from './emblem-paths.json';

// Decorative connection between the three editorial signals, not a metric scale.
export function IntelligenceScene({ active, signals }: { active: number; signals: {title:string;value:string;detail:string}[] }) {
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
      const [THREE, {SVGLoader}] = await Promise.all([import('three'),import('three/addons/loaders/SVGLoader.js')]);
      if (current !== generation) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'}); } catch { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
      target.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38,1,0.1,30); camera.position.z=7;
      const group = new THREE.Group(); scene.add(group);
      const gradientTime = {value:0};
      const svg='<svg xmlns="http://www.w3.org/2000/svg">'+paths.map(d=>'<path d="'+d+'"/>').join('')+'</svg>';
      const shapes=new SVGLoader().parse(svg).paths.flatMap(path=>path.toShapes());
      const geometry=new THREE.ExtrudeGeometry(shapes,{depth:18,bevelEnabled:true,bevelSize:1,bevelThickness:1,bevelSegments:2,curveSegments:8});
      geometry.center();geometry.rotateX(Math.PI);geometry.computeBoundingBox();
      const size=geometry.boundingBox!.getSize(new THREE.Vector3());const scale=3.3/Math.max(size.x,size.y);geometry.scale(scale,scale,scale);
      const material=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.32,roughness:.3});
      material.onBeforeCompile = shader => {
        shader.uniforms.gradientTime=gradientTime;
        shader.vertexShader='varying vec3 emblemPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nemblemPosition=position;');
        shader.fragmentShader='uniform float gradientTime; varying vec3 emblemPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat blend=.5+.5*sin(emblemPosition.x*1.5+emblemPosition.y*1.1+gradientTime*.45);\nvec3 silver=vec3(.72,.82,.92);vec3 cyan=vec3(.16,.65,.73);vec3 violet=vec3(.51,.39,.78);\nvec3 gradient=mix(cyan,violet,blend);diffuseColor.rgb=mix(gradient,silver,.3+.25*sin(emblemPosition.y*2.0-gradientTime*.25));');
      };
      const logo=new THREE.Mesh(geometry,material);group.add(logo);
      scene.add(new THREE.HemisphereLight(0xffffff,0x55786b,3));const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(2,3,5);scene.add(light);
      const pointer = {x:0,y:0};
      let frame=0,near=false,last=0,time=0;
      const draw = (now:number) => {
        frame=0;
        if (!near || document.hidden) return;
        if(now-last>=33){time+=Math.min((now-last)/1000,.04);last=now;
          group.rotation.y += (pointer.x*.35+(reduced.matches?0:Math.sin(time*.4)*.22)-group.rotation.y)*.06;
          group.rotation.x += (pointer.y*.25+(reduced.matches?0:Math.cos(time*.3)*.12)-group.rotation.x)*.06;
          group.position.y=reduced.matches?0:Math.sin(time*.65)*.065;
          if(!reduced.matches)logo.rotation.z=time*.13;
          gradientTime.value=reduced.matches?0:time;
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
      disposeScene=()=>{cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();target.removeEventListener('pointermove',move);target.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);geometry.dispose();material.dispose();renderer.dispose();renderer.domElement.remove();};
    };
    const change=()=>{void setup().catch(()=>{});};change();desktop.addEventListener('change',change);
    return()=>{generation++;desktop.removeEventListener('change',change);disposeScene?.();};
  },[]);
  return <div className="intelligence-art" aria-hidden="true"><div ref={host} className="intelligence-canvas"/><div className="intelligence-caption-stack">{signals.map((signal,i)=><div key={signal.title} className="intelligence-art-caption" data-current={active===i}><span>{signal.title}</span><strong>{signal.value}</strong><span>{signal.detail}</span></div>)}</div></div>;
}
