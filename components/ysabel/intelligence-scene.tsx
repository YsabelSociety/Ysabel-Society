'use client';
import { useEffect, useRef } from 'react';
import { appPath } from '@/lib/app-path';




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
    let disposeScene: (() => void) | undefined;
    let generation = 0;
    const setup = async () => {
      const current = ++generation;
      disposeScene?.(); disposeScene = undefined;
      if (!desktop.matches) return;
      const [THREE, fieldBytes] = await Promise.all([import('three'),fetch(appPath('/emblem-morph-fields.bin'),{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw new Error('Emblem shapes unavailable');return r.arrayBuffer();})]);
      if (current !== generation) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'}); } catch { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
      target.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38,1,0.1,30); camera.position.z=7;
      const group = new THREE.Group(); scene.add(group);

      const field=new THREE.DataTexture(new Uint8Array(fieldBytes),512,512,THREE.RGBAFormat);
      field.minFilter=field.magFilter=THREE.LinearFilter;field.needsUpdate=true;
      const geometry=new THREE.BoxGeometry(4.8,4.8,.32);
      const palette=[new THREE.Color('#dba300'),new THREE.Color('#1d3428'),new THREE.Color('#b32632'),new THREE.Color('#b9c3cc')];
      const uniforms={fields:{value:field},shapeA:{value:0},shapeB:{value:1},blend:{value:0},tint:{value:palette[0].clone()},localCamera:{value:new THREE.Vector3(0,0,7)}};
      const material=new THREE.ShaderMaterial({uniforms,
        vertexShader: 'varying vec3 localPosition;void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `
          precision highp float;
          uniform sampler2D fields;uniform int shapeA;uniform int shapeB;uniform float blend;
          uniform vec3 tint;uniform vec3 localCamera;varying vec3 localPosition;
          float channel(vec4 v,int i){if(i==0)return v.r;if(i==1)return v.g;if(i==2)return v.b;return v.a;}
          float surface(vec3 p){
            vec2 uv=vec2(p.x/4.4+.5,.5-p.y/4.4);
            vec4 sampled=texture2D(fields,clamp(uv,0.0,1.0));
            float d=(mix(channel(sampled,shapeA),channel(sampled,shapeB),blend)*255.0-128.0)*(.5*4.4/512.0);
            d=max(d,max(abs(p.x),abs(p.y))-2.2);
            return max(d,abs(p.z)-.085);
          }
          void main(){
            vec3 direction=normalize(localPosition-localCamera);vec3 p=localPosition+direction*.0001;
            bool hit=false;
            for(int i=0;i<96;i++){
              float d=surface(p);if(d<.0016){hit=true;break;}
              p+=direction*max(.001,d*.8);
              if(abs(p.z)>.165||max(abs(p.x),abs(p.y))>2.405)break;
            }
            if(!hit)discard;
            vec2 e=vec2(.003,0.0);
            vec3 n=normalize(vec3(surface(p+e.xyy)-surface(p-e.xyy),surface(p+e.yxy)-surface(p-e.yxy),surface(p+e.yyx)-surface(p-e.yyx)));
            vec3 light=normalize(vec3(-.4,.7,1.0));float diffuse=max(dot(n,light),0.0);
            float shine=pow(max(dot(reflect(-light,n),-direction),0.0),36.0);
            gl_FragColor=vec4(tint*(.55+diffuse*.65)+vec3(shine*.32),1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `});
      const logo=new THREE.Mesh(geometry,material);group.add(logo);
      const inverse=new THREE.Matrix4();
      const pointer = {x:0,y:0};
      let frame=0,near=false,last=0,time=0;
      const draw = (now:number) => {
        frame=0;
        if (!near || document.hidden) return;
        if(now-last>=33){time+=Math.min((now-last)/1000,.04);last=now;
          group.rotation.y += (pointer.x*.35+(reduced.matches?0:Math.sin(time*.4)*.22)-group.rotation.y)*.06;
          group.rotation.x += (pointer.y*.25+(reduced.matches?0:Math.cos(time*.3)*.12)-group.rotation.x)*.06;
          group.position.y=reduced.matches?0:Math.sin(time*.65)*.065;
          if(!reduced.matches)logo.rotation.z=Math.sin(time*.18)*.12;
          const phase=reduced.matches?0:time/7;
          const index=Math.floor(phase)%4;
          const transition=Math.max(0,Math.min(1,((phase%1)-.5)*2));
          const eased=transition*transition*transition*(transition*(transition*6-15)+10);
          uniforms.shapeA.value=index;uniforms.shapeB.value=(index+1)%4;uniforms.blend.value=eased;
          uniforms.tint.value.copy(palette[index]).lerp(palette[(index+1)%4],eased);
          target.dataset.emblemShape=String(index);target.dataset.emblemBlend=eased.toFixed(3);
          group.updateMatrixWorld(true);
          logo.updateMatrixWorld(true);
          uniforms.localCamera.value.copy(camera.position).applyMatrix4(inverse.copy(logo.matrixWorld).invert());
          cards.current.forEach((card,i)=>{
            if(!card)return;
            const count=36;
            const angle=i*2.39996+(reduced.matches?0:time*.055);
            const radius=1.75*Math.sqrt((i+.5)/count);
            const point=new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,.28+Math.sin(i*1.7+(reduced.matches?0:time*.5))*.14);
            point.applyMatrix4(group.matrixWorld).project(camera);
            const width=target.clientWidth,height=target.clientHeight;
            card.style.left=((point.x+1)*width/2)+'px';card.style.top=((-point.y+1)*height/2)+'px';
            card.style.transform='translate(-50%,-50%) perspective(600px) rotateY('+(group.rotation.y*25)+'deg) rotateX('+(-group.rotation.x*25)+'deg) rotate('+Math.sin(i*1.5+(reduced.matches?0:time*.3))*4+'deg)';
            card.style.opacity=String(.25+.45*(.5+.5*Math.sin(i+time*.6)));
            card.textContent=String((i+Math.floor(reduced.matches?0:time*.8))%2);
          });
          renderer.render(scene,camera);
        }
        frame=requestAnimationFrame(draw);
      };
      const start=()=>{if(near&&!document.hidden&&!frame)frame=requestAnimationFrame(draw);};
      const observer=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;if(near)start();else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'80px'});observer.observe(target);
      const resize=new ResizeObserver(()=>{const {width,height}=target.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.position.z=Math.max(7,7/camera.aspect);camera.updateProjectionMatrix();});resize.observe(target);
      const move=(e:PointerEvent)=>{const r=target.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width*2-1;pointer.y=(e.clientY-r.top)/r.height*2-1;};
      const leave=()=>{pointer.x=pointer.y=0;};
      const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();};
      target.addEventListener('pointermove',move);target.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);
      disposeScene=()=>{cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();target.removeEventListener('pointermove',move);target.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);geometry.dispose();material.dispose();field.dispose();renderer.dispose();renderer.domElement.remove();};
    };
    const change=()=>{void setup().catch(()=>{});};change();desktop.addEventListener('change',change);
    return()=>{generation++;desktop.removeEventListener('change',change);disposeScene?.();};
  },[]);
  return <div className="intelligence-art" aria-hidden="true"><div ref={host} className="intelligence-canvas">{Array.from({length:36},(_,i)=><div key={i} ref={node=>{cards.current[i]=node;}} className="emblem-digit">{i%2}</div>)}</div><div className="intelligence-caption-stack">{signals.map((signal,i)=><div key={signal.title} className="intelligence-art-caption" data-current={active===i}><span>{signal.title}</span><strong>{signal.value}</strong><span>{signal.detail}</span></div>)}</div></div>;
}
