import * as THREE from 'three';

// A restrained pearl light field shared by the introduction and loading scene.
export function createIntroBackdrop(
  scene: THREE.Scene,
  {
    softEdges = false,
    loading = false,
  }: { softEdges?: boolean; loading?: boolean } = {},
) {
  const uniforms = {
    time: { value: 0 },
    softEdges: { value: softEdges ? 1 : 0 },
    loading: { value: loading ? 1 : 0 },
    focus: { value: new THREE.Vector2() },
    pearl: { value: new THREE.Color(loading ? '#d1dcd4' : '#e1e8e3') },
    white: { value: new THREE.Color('#ffffff') },
  };
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    // Stay in the opaque render queue so the light field cannot cover the logo.
    blending: softEdges ? THREE.CustomBlending : THREE.NoBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.999,1.0);}`,
    fragmentShader: `varying vec2 vUv;
      uniform float time;
      uniform float softEdges;
      uniform float loading;
      uniform vec2 focus;
      uniform vec3 pearl, white;
      void main(){
        vec2 center=vec2(.46+sin(time*.12)*.12,.55+cos(time*.15)*.10)+focus*.025;
        float pool=1.0-smoothstep(.05,.88,length((vUv-center)*vec2(.92,1.0)));
        float sweep=.5+.5*sin(vUv.x*3.0+vUv.y*1.8-time*.13);
        vec3 color=mix(pearl,white,clamp(.25+pool*.7+sweep*.06,0.,1.));
        vec2 glowCenter=vec2(.28+sin(time*.11)*.12,.72+cos(time*.09)*.08)+focus*.03;
        float glow=exp(-dot((vUv-glowCenter)*vec2(1.2,.9),(vUv-glowCenter)*vec2(1.2,.9))*3.4);
        float diagonal=clamp(.18+(1.0-vUv.x)*.34+vUv.y*.12+sweep*.08,0.,1.);
        vec3 loadingColor=mix(mix(pearl,white,diagonal),white,glow*.82);
        color=mix(color,loadingColor,loading);
        float edge=min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y));
        gl_FragColor=vec4(color,mix(1.0,smoothstep(0.0,.12,edge),softEdges));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  scene.add(mesh);
  return {
    update(time: number, x = 0, y = 0) {
      uniforms.time.value = time;
      uniforms.focus.value.set(x, y);
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
