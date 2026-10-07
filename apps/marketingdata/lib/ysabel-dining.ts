import type * as Three from 'three';

/** Architectural ambience only: these silhouettes never represent guest counts or live occupancy. */
export function createYsabelDining(T: typeof Three, groups: Map<string, Three.Group>) {
  const roomSpecs = [
    { id: 'italian', floor: 23.3, width: 4.6, depth: 1.55, z: 1.45, tables: [[-1.08, 1.45], [1.08, 1.45]], accent: '#dec586' },
    { id: 'asian', floor: 25.5, width: 4.6, depth: 1.2, z: 1.2, tables: [[-1.1, 1.3], [1.1, 1.3]], accent: '#d89695' },
    { id: 'garden', floor: 27.66, width: 8.3, depth: 6, z: -1.55, tables: [[-2.25, -.15], [0, -.15], [2.25, -.15], [-2.25, -2.65], [0, -2.65], [2.25, -2.65]], accent: '#8bb5a4' },
  ];
  const box = new T.BoxGeometry(1, 1, 1), cylinder = new T.CylinderGeometry(1, 1, 1, 20);
  const headGeometry = new T.SphereGeometry(.076, 12, 8), bodyGeometry = new T.CapsuleGeometry(.075, .15, 3, 8), armGeometry = new T.CapsuleGeometry(.023, .15, 2, 6);
  const warm = new T.Color('#ffe4b8');
  const linen = new T.MeshStandardMaterial({ color: '#f1e8d6', roughness: .72, emissive: '#ab8a58', emissiveIntensity: .04 });
  const timber = new T.MeshStandardMaterial({ color: '#685646', roughness: .78 });
  const brass = new T.MeshStandardMaterial({ color: '#b39b73', metalness: .65, roughness: .3 });
  const ceramic = new T.MeshStandardMaterial({ color: '#e9e7de', roughness: .32, metalness: .05 });
  const glass = new T.MeshStandardMaterial({ color: '#c6d4cf', metalness: .35, roughness: .17 });
  const skin = new T.MeshStandardMaterial({ color: '#cbb89f', roughness: .8, emissive: '#785b3d', emissiveIntensity: .02 });
  const clothes = new T.MeshStandardMaterial({ color: '#34433e', roughness: .85 });
  const candles = new T.MeshBasicMaterial({ color: '#ffe4b8', transparent: true, opacity: .15, toneMapped: false });
  type Batch = { geometry: Three.BufferGeometry; material: Three.Material; zone: string; matrices: Three.Matrix4[] };
  const batches = new Map<string, Batch>();
  const matrix = new T.Matrix4(), quaternion = new T.Quaternion(), position = new T.Vector3(), scale = new T.Vector3();
  const instance = (geometry: Three.BufferGeometry, material: Three.Material, zone: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0) => {
    const key = geometry.uuid + material.uuid + zone;
    if (!batches.has(key)) batches.set(key, { geometry, material, zone, matrices: [] });
    quaternion.setFromAxisAngle(T.Object3D.DEFAULT_UP, yaw);
    matrix.compose(position.set(x, y, z), quaternion, scale.set(sx, sy, sz));
    batches.get(key)!.matrices.push(matrix.clone());
  };
  type Guest = { x: number; y: number; z: number; yaw: number; phase: number };
  const rooms: { id: string; guests: Guest[]; bodies: Three.InstancedMesh; heads: Three.InstancedMesh; arms: Three.InstancedMesh; light: Three.PointLight; floor: Three.MeshStandardMaterial; accent: Three.MeshStandardMaterial }[] = [];
  let guestIndex = 0;
  for (const room of roomSpecs) {
    const group = groups.get(room.id)!;
    const floor = new T.MeshStandardMaterial({ color: '#867963', roughness: .82, emissive: '#b99564', emissiveIntensity: .04 });
    const upholstery = new T.MeshStandardMaterial({ color: new T.Color(room.accent).multiplyScalar(.7), roughness: .9 });
    instance(box, floor, room.id, 0, room.floor - .015, room.z, room.width, .06, room.depth);
    // A warm back wall and slender light rails create depth beneath the original glazing.
    if (room.id !== 'garden') instance(box, timber, room.id, 0, room.floor + .64, .66, room.width - .2, 1.2, .055);
    instance(box, brass, room.id, 0, room.floor + .04, room.z + room.depth / 2 - .05, room.width - .12, .025, .025);
    const guests: Guest[] = [];
    for (const [x, z] of room.tables) {
      instance(cylinder, linen, room.id, x, room.floor + .46, z, .34, .045, .34);
      instance(cylinder, brass, room.id, x, room.floor + .24, z, .045, .44, .045);
      instance(cylinder, timber, room.id, x, room.floor + .035, z, .16, .035, .16);
      instance(cylinder, brass, room.id, x, room.floor + .50, z, .028, .055, .028);
      instance(headGeometry, candles, room.id, x, room.floor + .55, z, .22, .35, .22);
      // Two place settings; small reflective glassware reads cleanly at rooftop zoom.
      for (const side of [-1, 1]) {
        instance(cylinder, ceramic, room.id, x, room.floor + .488, z + side * .2, .105, .012, .105);
        instance(cylinder, glass, room.id, x + .16, room.floor + .525, z + side * .15, .027, .07, .027);
        const seatZ = z + side * .43;
        instance(box, upholstery, room.id, x, room.floor + .26, seatZ, .23, .05, .23);
        instance(box, upholstery, room.id, x, room.floor + .41, seatZ + side * .12, .23, .27, .035);
        for (const dx of [-.075, .075]) for (const dz of [-.075, .075]) instance(box, timber, room.id, x + dx, room.floor + .13, seatZ + dz, .023, .24, .023);
        guests.push({ x, y: room.floor, z: seatZ, yaw: side > 0 ? Math.PI : 0, phase: guestIndex++ * 2.399 });
      }
      const pendantY = room.floor + (room.id === 'garden' ? 1.25 : 1.46);
      instance(cylinder, brass, room.id, x, pendantY + .09, z, .007, .18, .007);
      instance(cylinder, linen, room.id, x, pendantY, z, .1, .05, .1);
      instance(cylinder, candles, room.id, x, pendantY - .035, z, .074, .013, .074);
    }
    const bodies = new T.InstancedMesh(bodyGeometry, clothes, guests.length);
    const heads = new T.InstancedMesh(headGeometry, skin, guests.length);
    const arms = new T.InstancedMesh(armGeometry, clothes, guests.length * 2);
    [bodies, heads, arms].forEach(mesh => { mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; group.add(mesh); });
    const light = new T.PointLight(warm, 0, room.id === 'garden' ? 8 : 5, 2);
    light.position.set(0, room.floor + 1.4, room.z); group.add(light);
    rooms.push({ id: room.id, guests, bodies, heads, arms, light, floor, accent: upholstery });
  }
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true;
    groups.get(batch.zone)!.add(mesh);
  }
  const root = new T.Matrix4(), local = new T.Matrix4(), rotation = new T.Euler();
  const torsoScale = new T.Vector3(1.05, 1, .8), headScale = new T.Vector3(1, 1.12, .92), armScale = new T.Vector3(1, 1, 1);
  let lastTime = -1, lastNight = -1, lastFocus = '';
  const update = (time: number, night: number, animated: boolean, focus = 'all') => {
    if (Math.abs(lastNight - night) > .001 || lastFocus !== focus) {
      const glow = night * night * (3 - 2 * night);
      rooms.forEach(room => {
        const emphasis = focus === 'all' || focus === room.id ? 1 : .28;
        room.light.intensity = glow * (room.id === 'garden' ? 19 : 12) * emphasis;
        room.floor.emissiveIntensity = .035 + glow * .4 * emphasis;
        room.accent.emissive.copy(warm); room.accent.emissiveIntensity = glow * .1 * emphasis;
      });
      linen.emissiveIntensity = .035 + glow * .16;
      skin.emissiveIntensity = .02 + glow * .1;
      candles.opacity = .12 + glow * .88;
      lastNight = night; lastFocus = focus;
    }
    // All movement shares the existing paused/offscreen loop. Daytime and reduced-motion views rest.
    if (lastTime >= 0 && (!animated || night < .06 || time - lastTime < 1 / 30)) return;
    rooms.forEach(room => {
      room.guests.forEach((guest, i) => {
        const turn = animated ? Math.sin(time * .27 + guest.phase) * .065 : 0;
        const breath = animated ? Math.sin(time * .64 + guest.phase) * .004 : 0;
        quaternion.setFromAxisAngle(T.Object3D.DEFAULT_UP, guest.yaw + turn);
        root.compose(position.set(guest.x, guest.y, guest.z), quaternion, armScale);
        quaternion.setFromEuler(rotation.set(.04 + turn * .2, 0, 0));
        local.compose(position.set(0, .45 + breath, 0), quaternion, torsoScale);
        room.bodies.setMatrixAt(i, matrix.multiplyMatrices(root, local));
        quaternion.setFromEuler(rotation.set(turn * .3, turn * .8, 0));
        local.compose(position.set(0, .68 + breath, .014), quaternion, headScale);
        room.heads.setMatrixAt(i, matrix.multiplyMatrices(root, local));
        for (const side of [-1, 1]) {
          const gesture = animated ? Math.pow(Math.max(0, Math.sin(time * .34 + guest.phase + side)), 6) : 0;
          quaternion.setFromEuler(rotation.set(-1.05 + gesture * .45, 0, side * (.08 + gesture * .1)));
          local.compose(position.set(side * .1, .49 + gesture * .045 + breath, .09), quaternion, armScale);
          room.arms.setMatrixAt(i * 2 + (side === 1 ? 1 : 0), matrix.multiplyMatrices(root, local));
        }
      });
      room.bodies.instanceMatrix.needsUpdate = true; room.heads.instanceMatrix.needsUpdate = true; room.arms.instanceMatrix.needsUpdate = true;
    });
    lastTime = time;
  };
  update(0, 0, false);
  return { update };
}
