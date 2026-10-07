import type * as Three from 'three';

/** Photo-inspired Garden arrangement, not a measured plan or a record of seating capacity. */
export function buildGardenInterior(T: typeof Three) {
  const group = new T.Group(); group.name = 'Ysabel Garden photo-inspired interior'; group.visible = false;
  const floorY = 27.63, textures: Three.Texture[] = [];
  const material = (color: string, roughness = .7, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
  const stone = material('#b4afa0', .46), wood = material('#514537', .6), brass = material('#aa8b51', .3, .7);
  const onyx = material('#ddc49b', .34); onyx.emissive.set('#d5a450');
  const marble = material('#c6c4b7', .22, .06), cream = material('#d9d0ae', .78), mirror = material('#8cacae', .13, .9);
  const rust = material('#924b3f', .9), velvet = material('#bc877e', .95), teal = material('#3a686e', .86);
  const cushion = material('#7c8c5c', .95), ceramic = material('#7a7464', .5), leaf = material('#46684a', .9);
  const dark = material('#334741', .68), petal = material('#c7b795', .55, .28), plate = material('#e8dfca', .32);
  const glow = new T.MeshStandardMaterial({ color: '#e5c99f', emissive: '#ffdfac', emissiveIntensity: .35, roughness: .6, side: T.DoubleSide });
  // Fine woven chevrons recall the window chairs; warm mottling recalls the back-lit bar.
  const textile = document.createElement('canvas'); textile.width = textile.height = 128;
  const tx = textile.getContext('2d')!; tx.fillStyle = '#747f73'; tx.fillRect(0, 0, 128, 128);
  tx.strokeStyle = '#d6d2ba'; tx.lineWidth = 7;
  for (let y = -16; y < 144; y += 28) { tx.beginPath(); for (let x = -16; x < 144; x += 16) tx.lineTo(x, y + (Math.round(x / 16) % 2 ? 18 : 0)); tx.stroke(); }
  const cloth = new T.CanvasTexture(textile); cloth.colorSpace = T.SRGBColorSpace; textures.push(cloth);
  const patterned = material('#ffffff', .9); patterned.map = cloth;
  const stoneCanvas = document.createElement('canvas'); stoneCanvas.width = stoneCanvas.height = 128;
  const ctx = stoneCanvas.getContext('2d')!, image = ctx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const x = i % 128, y = i >> 7, vein = Math.sin(x * .07 + Math.sin(y * .11) * 2.2) * 12 + Math.cos(y * .04 + x * .03) * 9; image.data.set([218 + vein, 200 + vein, 167 + vein, 255], i * 4); }
  ctx.putImageData(image, 0, 0); const stoneTexture = new T.CanvasTexture(stoneCanvas); stoneTexture.colorSpace = T.SRGBColorSpace; textures.push(stoneTexture); onyx.map = stoneTexture;
  const boxGeometry = new T.BoxGeometry(1, 1, 1), roundGeometry = new T.CylinderGeometry(1, 1, 1, 28);
  const foliageGeometry = new T.IcosahedronGeometry(1, 1), archGeometry = new T.TorusGeometry(.34, .022, 6, 32, Math.PI);
  type Batch = { geometry: Three.BufferGeometry; material: Three.Material; matrices: Three.Matrix4[] };
  const batches = new Map<string, Batch>(), matrix = new T.Matrix4(), q = new T.Quaternion(), euler = new T.Euler(), pos = new T.Vector3(), scale = new T.Vector3();
  // Exchange the bar and the opposite dining row. The bar faces back into the room.
  const barPlacement = new T.Matrix4().makeTranslation(0, 0, .55)
    .multiply(new T.Matrix4().makeRotationY(Math.PI))
    .multiply(new T.Matrix4().makeTranslation(0, 0, 3.5));
  let placement: Three.Matrix4 | null = null;
  const add = (geometry: Three.BufferGeometry, m: Three.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0, pitch = 0, roll = 0) => {
    const key = geometry.uuid + m.uuid; if (!batches.has(key)) batches.set(key, { geometry, material: m, matrices: [] });
    q.setFromEuler(euler.set(pitch, yaw, roll)); matrix.compose(pos.set(x, floorY + y, z), q, scale.set(sx, sy, sz));
    if (placement) matrix.premultiply(placement);
    batches.get(key)!.matrices.push(matrix.clone());
  };
  const box = (m: Three.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0) => add(boxGeometry, m, x, y, z, sx, sy, sz, yaw);
  const round = (m: Three.Material, x: number, y: number, z: number, radius: number, height: number) => add(roundGeometry, m, x, y, z, radius, height, radius);
  box(stone, 0, -.07, -1.7, 8.45, .14, 6.35);
  // Bar: champagne onyx front, brass rails, six arches and mirrored bottle shelves.
  placement = barPlacement;
  for (const y of [.34, .75]) { box(y === .75 ? marble : onyx, 0, y, -3.5, 5.3, y === .75 ? .06 : .68, .6); for (const x of [-2.65, 2.65]) round(y === .75 ? marble : onyx, x, y, -3.5, .3, y === .75 ? .06 : .68); }
  for (const y of [.16, .53]) box(brass, 0, y, -3.19, 5.3, .018, .018);
  const bottleMaterials = ['#435b43', '#967445', '#b1b6a1', '#765847'].map(c => material(c, .23, .2));
  for (let i = 0; i < 6; i++) {
    const x = -2.15 + i * .86;
    box(mirror, x, .76, -4.28, .61, .87, .025);
    add(archGeometry, brass, x, 1.0, -4.24, 1, 1, 1);
    for (const dx of [-.34, .34]) box(wood, x + dx, .56, -4.25, .044, 1.05, .12);
    for (const y of [.27, .65, 1.02]) {
      box(wood, x, y, -4.12, .67, .04, .29);
      for (let j = 0; j < 5; j++) { const bx = x - .24 + j * .12, m = bottleMaterials[(i + j) % 4]; round(m, bx, y + .12, -4.1, .035, .15); round(m, bx, y + .215, -4.1, .014, .04); }
    }
  }
  for (const x of [-2.1, -1.05, 0, 1.05, 2.1]) {
    round(brass, x, .27, -2.83, .025, .5); round(dark, x, .025, -2.83, .16, .025);
    round(velvet, x, .54, -2.83, .17, .1); box(velvet, x, .72, -2.95, .32, .31, .045);
  }
  placement = null;
  // Cream panelled feature wall and mirrors, with a slim border of trailing greenery.
  box(cream, -3.0, .54, -1.25, .1, 1.05, 2.05);
  for (const z of [-1.85, -.76]) {
    box(mirror, -2.94, .57, z, .024, .62, .4);
    for (const y of [.235, .905]) box(brass, -2.92, y, z, .028, .025, .46);
    for (const dz of [-.23, .23]) box(brass, -2.92, .57, z + dz, .028, .67, .025);
  }
  const plant = (x: number, z: number, height = .75) => {
    round(brass, x, .16, z, .14, .32); round(wood, x, height * .5, z, .012, height);
    for (let i = 0; i < 9; i++) { const angle = i * 2.399; add(foliageGeometry, leaf, x + Math.cos(angle) * .13, height * .75 + i % 3 * .065, z + Math.sin(angle) * .13, .1, .22, .07, angle, .38, Math.sin(angle) * .3); }
  };
  plant(-2.7, -2.33, .86); plant(2.75, -2.35, .9); plant(3.35, -.7, .64); plant(-3.45, .55, .58); plant(3.45, .7, .58);
  for (let i = 0; i < 9; i++) add(foliageGeometry, leaf, -2.94 + (i % 2) * .05, .94 - (i % 3) * .09, -2.18 + i * .22, .065, .12, .07);
  const chair = (x: number, z: number, yaw: number) => {
    box(teal, x, .3, z, .33, .1, .33, yaw);
    const bx = x - Math.sin(yaw) * .16, bz = z - Math.cos(yaw) * .16;
    box(patterned, bx, .53, bz, .35, .38, .045, yaw);
    for (const dx of [-.11, .11]) for (const dz of [-.11, .11]) { const xx = x + dx * Math.cos(yaw) + dz * Math.sin(yaw), zz = z - dx * Math.sin(yaw) + dz * Math.cos(yaw); box(dark, xx, .14, zz, .02, .28, .02); }
  };
  const table = (x: number, z: number, roundTop = true) => {
    if (roundTop) round(marble, x, .62, z, .36, .045); else box(marble, x, .5, z, .79, .045, .52);
    round(dark, x, .3, z, .035, .58); round(dark, x, .025, z, .18, .025);
    round(ceramic, x + .05, roundTop ? .72 : .6, z, .06, .15);
    for (const dx of [-.17, .17]) round(plate, x + dx, roundTop ? .653 : .533, z, .065, .009);
  };
  // Warm red lounge banquettes; olive cushions and stone tables echo the supplied photographs.
  for (const [x, z] of [[-1.3, -1.65], [.35, -1.45], [1.95, -1.45]]) {
    table(x, z, false); box(rust, x, .24, z + .43, 1.1, .28, .35); box(rust, x, .49, z + .59, 1.1, .46, .09);
    for (const dx of [-.3, .3]) box(cushion, x + dx, .51, z + .5, .23, .22, .1, dx * .12);
    chair(x, z - .5, Math.PI);
  }
  // The former bar side now holds the round tables and blue woven dining chairs.
  for (const x of [-2.35, -.8, .8, 2.35]) { table(x, -3.5); chair(x - .5, -3.5, Math.PI / 2); chair(x + .5, -3.5, -Math.PI / 2); }
  const rail = new T.MeshPhysicalMaterial({ color: '#bad6dd', transparent: true, opacity: .18, roughness: .12, metalness: .2, depthWrite: false });
  box(rail, 0, .42, 1.4, 8.2, .8, .025); box(brass, 0, .83, 1.4, 8.2, .016, .026);
  for (let i = 0; i < 10; i++) box(brass, -4.05 + i * .9, .4, 1.4, .014, .8, .014);
  // Sculptural flower pendants: folded metal petals and fine suspension wires.
  const vertices: number[] = [];
  const petals = 6, steps = 36;
  for (let i = 0; i < steps; i++) {
    const a = i / steps * Math.PI * 2, b = (i + 1) / steps * Math.PI * 2;
    const edge = (angle: number) => { const r = .28 + .08 * Math.cos(angle * petals); return [Math.cos(angle) * r, .055 + .075 * Math.cos(angle * petals), Math.sin(angle) * r]; };
    vertices.push(0, -.08, 0, ...edge(a), ...edge(b));
  }
  const flowerGeometry = new T.BufferGeometry(); flowerGeometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); flowerGeometry.computeVertexNormals(); petal.side = T.DoubleSide;
  for (const [x, z, y] of [[-1.45, -1.85, 1.35], [1.25, -1.55, 1.45], [0, .35, 1.75]]) {
    add(flowerGeometry, petal, x, y, z, 1, 1, 1); round(glow, x, y - .055, z, .16, .018);
    const v = (z + 5) / 6.6, roof = (1.65 + .85 * v) * Math.sin((x + 4.4) / 8.8 * Math.PI);
    for (const dx of [-.09, .09]) { const length = Math.max(.02, roof - y - .045); box(brass, x + dx, y + length / 2 + .04, z, .004, length, .004); }
  }
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length); batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  }
  const warmLight = new T.PointLight('#ffead0', 7, 11, 2); warmLight.position.set(0, floorY + 2.0, -1.4); group.add(warmLight);
  const barLight = new T.PointLight('#ffe0a5', 3, 7, 2); barLight.position.set(0, floorY + 1.1, -3.0).applyMatrix4(barPlacement); group.add(barLight);
  let lastNight = -1;
  const updateLighting = (night: number) => { if (Math.abs(night - lastNight) < .001) return; warmLight.intensity = 4 + night * 8; barLight.intensity = 1 + night * 4; onyx.emissiveIntensity = .08 + night * .25; glow.emissiveIntensity = .25 + night * .6; lastNight = night; };
  updateLighting(0);
  return { group, textures, updateLighting };
}
