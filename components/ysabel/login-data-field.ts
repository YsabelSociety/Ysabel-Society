import * as THREE from 'three';
import { createLoginStatistics } from './login-statistics';
import { INTRO_LOGO_COLOR } from './brand-appearance';

const vertex = `
  attribute vec3 aOrigin;
  attribute vec3 aDestination;
  attribute float aGlyph;
  attribute float aSeed;
  attribute float aSize;
  uniform float uProgress;
  uniform float uTime;
  uniform float uAspect;
  uniform float uEquation;
  varying vec2 vUv;
  varying float vGlyph;
  varying float vAlpha;
  void main() {
    float arrive = smoothstep(.08+aSeed*.16, .76+aSeed*.18, uProgress);
    float turn = uTime*.018*(.3+aSeed*.4);
    vec3 end = aDestination;
    end.xz = mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*end.xz;
    end.y += sin(uTime*.22+aSeed*47.0)*.08;
    vec3 center = mix(aOrigin,end,arrive);
    float flight = sin(arrive*3.14159265);
    center += vec3(sin(aSeed*67.0+arrive*4.0),cos(aSeed*43.0+arrive*3.0),1.3)*flight*.5;
    vec4 viewPosition = modelViewMatrix*vec4(center,1.0);
    viewPosition.xy += position.xy*vec2(uAspect,1.0)*aSize*(.4+.6*arrive);
    gl_Position = projectionMatrix*viewPosition;
    vUv = uv;
    vGlyph = aGlyph;
    float depth = 1.0-smoothstep(7.0,16.0,-viewPosition.z);
    vAlpha = smoothstep(.05,.28,arrive) * mix(.12+.38*aSeed,.86,uEquation) * (.45+.55*depth);
  }
`;
const fragment = `
  uniform sampler2D uAtlas;
  uniform vec2 uGrid;
  uniform vec3 uInk;
  varying vec2 vUv;
  varying float vGlyph;
  varying float vAlpha;
  void main() {
    vec2 cell = vec2(mod(vGlyph,uGrid.x),uGrid.y-1.0-floor(vGlyph/uGrid.x));
    float ink = texture2D(uAtlas,(cell+vUv)/uGrid).a;
    float alpha = ink*vAlpha;
    if(alpha<.018) discard;
    gl_FragColor = vec4(uInk,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Decorative typography only. The public intro never loads private analytics.
const formulae = [
  'a² + b² = c²',
  'φ = (1 + √5) / 2',
  'A = πr²',
  'Σ pᵢ = 1',
  'eⁱπ + 1 = 0',
  'y = α + βx',
  'f(x) = ∫ g(x) dx',
  'Δy / Δx',
  'CTR = clicks / impressions × 100',
  'ROAS = revenue / ad spend',
  'reach → engagement → action',
  'Σ interactions',
  'P(A ∩ B) = P(A)P(B | A)',
  'μ = Σxᵢ / n',
  'Instagram · engagement',
  'Facebook · conversations',
  'TikTok · views',
  'Google · discovery',
  'Website · sessions',
  'Ι · ΙΙ · ΙΙΙ · ΙV · V',
  'Α · Β · Γ · Δ · Ε',
  'x(t) → x(t + Δt)',
  'dy / dx',
  'π ≈ 3.14159265',
  '∑ → ∞',
  '01 · 10 · 11 · 100',
  '∂f / ∂x',
  'r² = x² + y²',
];

export function createLoginDataField(
  parent: THREE.Group,
  origins: THREE.Vector3[],
) {
  const resources: { dispose: () => void }[] = [];
  const numberCount = 3600;
  const group = new THREE.Group();
  parent.add(group);

  function atlas(
    items: string[],
    columns: number,
    width: number,
    height: number,
    font: string,
  ) {
    const rows = Math.ceil(items.length / columns);
    const canvas = document.createElement('canvas');
    canvas.width = columns * width;
    canvas.height = rows * height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    items.forEach((item, i) =>
      context.fillText(
        item,
        ((i % columns) + 0.5) * width,
        (Math.floor(i / columns) + 0.5) * height,
        width - 16,
      ),
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    resources.push(texture);
    return { texture, columns, rows };
  }

  const digits = atlas(
    [
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'Σ',
      'π',
      '∞',
      '∂',
      '∫',
      'Δ',
      'α',
      'β',
      'λ',
      'μ',
      'φ',
      'θ',
      '+',
      '−',
      '×',
      '=',
      '√',
      '%',
      '<',
      '>',
      '∈',
      '∴',
    ],
    8,
    64,
    64,
    '46px Georgia',
  );
  const equations = atlas(formulae, 4, 512, 64, '30px Georgia');

  function field(
    count: number,
    isEquation: boolean,
    source: ReturnType<typeof atlas>,
  ) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
        3,
      ),
    );
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    const starts: number[] = [],
      ends: number[] = [],
      glyphs: number[] = [],
      seeds: number[] = [],
      sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const seed = ((i * 16807 + 73) % 65521) / 65521;
      const origin = origins[(i * 37) % origins.length];
      starts.push(origin.x, origin.y, origin.z);
      if (isEquation) {
        const angle = i * 2.39996323;
        const radius = 1.05 + 1.7 * Math.sqrt(i / count);
        ends.push(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.79,
          0.8 + Math.sin(i * 2.3) * 0.45,
        );
        glyphs.push(i % formulae.length);
        sizes.push(0.12 + 0.035 * seed);
      } else {
        // Three spiralling streams hold 3,120 digits plus 480 mathematical symbols.
        const lane = i % 3;
        const angle = (i / count) * Math.PI * 18 + lane * 2.094;
        const radius = 1.7 + lane * 0.32 + seed * 0.6;
        ends.push(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.77 + (seed - 0.5) * 0.28,
          Math.sin(angle * 1.7 + lane) * 1.3 - 0.55,
        );
        glyphs.push(i < 3120 ? i % 10 : 10 + (i % 22));
        sizes.push(0.055 + seed * 0.08);
      }
      seeds.push(seed);
    }
    geometry.setAttribute(
      'aOrigin',
      new THREE.InstancedBufferAttribute(new Float32Array(starts), 3),
    );
    geometry.setAttribute(
      'aDestination',
      new THREE.InstancedBufferAttribute(new Float32Array(ends), 3),
    );
    geometry.setAttribute(
      'aGlyph',
      new THREE.InstancedBufferAttribute(new Float32Array(glyphs), 1),
    );
    geometry.setAttribute(
      'aSeed',
      new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1),
    );
    geometry.setAttribute(
      'aSize',
      new THREE.InstancedBufferAttribute(new Float32Array(sizes), 1),
    );
    geometry.instanceCount = count;
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
      uniforms: {
        uAtlas: { value: source.texture },
        uGrid: { value: new THREE.Vector2(source.columns, source.rows) },
        uInk: { value: new THREE.Color(INTRO_LOGO_COLOR) },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: isEquation ? 8 : 1 },
        uEquation: { value: isEquation ? 1 : 0 },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    group.add(mesh);
    resources.push(geometry, material);
    return material;
  }
  const numbers = field(numberCount, false, digits);
  const formulas = field(formulae.length, true, equations);

  const statistics = createLoginStatistics(group);

  return {
    update(progress: number, time: number) {
      group.visible = progress > 0.015;
      numbers.uniforms.uProgress.value = progress;
      numbers.uniforms.uTime.value = time;
      formulas.uniforms.uProgress.value = progress;
      formulas.uniforms.uTime.value = time;
      statistics.update(progress, time);
    },
    dispose() {
      statistics.dispose();
      parent.remove(group);
      resources.forEach((resource) => resource.dispose());
    },
  };
}
