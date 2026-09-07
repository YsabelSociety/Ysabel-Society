import * as THREE from 'three';

export const INTRO_CHART_TYPES = [
  'columns',
  'grouped-columns',
  'stacked-columns',
  'horizontal-bars',
  'histogram',
  'line',
  'multiple-lines',
  'area',
  'donut',
  'pie',
  'scatter',
  'bubbles',
  'radar',
  'heatmap',
  'candlesticks',
  'gauge',
] as const;

export function createLoginStatistics(parent: THREE.Group) {
  const root = new THREE.Group();
  parent.add(root);
  const resources: { dispose: () => void }[] = [];
  const palette = [0x1d3428, 0x536b5e, 0x84938a, 0x2d2c2c];
  const materials = palette.map(
    (color) =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.48,
        roughness: 0.32,
      }),
  );
  const lines = palette.map(
    (color) =>
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  const axes = new THREE.LineBasicMaterial({
    color: 0x536b5e,
    transparent: true,
    opacity: 0.25,
  });
  const filled = new THREE.MeshBasicMaterial({
    color: 0x536b5e,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const unitBar = new THREE.BoxGeometry(1, 1, 0.065);
  const dot = new THREE.SphereGeometry(1, 8, 6);
  resources.push(...materials, ...lines, axes, filled, unitBar, dot);
  const wave = (t: number, i: number, rate = 0.6) =>
    0.5 + 0.5 * Math.sin(t * rate + i * 1.43);
  const signal = (x: number, t: number, series: number) =>
    -0.09 +
    0.13 * Math.sin(x * 5 + t * 0.62 + series) +
    0.07 * Math.sin(x * 10 - t * 0.4 + series) +
    x * 0.14;

  function polyline(group: THREE.Group, points: number[], material = lines[0]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    );
    resources.push(geometry);
    group.add(new THREE.Line(geometry, material));
    return geometry.getAttribute('position') as THREE.BufferAttribute;
  }
  function bar(group: THREE.Group, color: number) {
    const mesh = new THREE.Mesh(unitBar, materials[color % 4]);
    group.add(mesh);
    return mesh;
  }
  function marker(group: THREE.Group, color: number, size = 0.024) {
    const mesh = new THREE.Mesh(dot, materials[color % 4]);
    mesh.scale.setScalar(size);
    group.add(mesh);
    return mesh;
  }
  function sector(
    group: THREE.Group,
    color: number,
    inner: number,
    outer: number,
  ) {
    const steps = 24;
    const positions = new Float32Array((steps + 1) * 6);
    const indices: number[] = [];
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({
      color: palette[color % 4],
      side: THREE.DoubleSide,
    });
    resources.push(geometry, material);
    group.add(new THREE.Mesh(geometry, material));
    return (start: number, end: number) => {
      for (let i = 0; i <= steps; i++) {
        const angle = start + ((end - start) * i) / steps;
        positions.set(
          [
            Math.cos(angle) * inner,
            Math.sin(angle) * inner,
            0,
            Math.cos(angle) * outer,
            Math.sin(angle) * outer,
            0.005,
          ],
          i * 6,
        );
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeBoundingSphere();
    };
  }

  const charts = INTRO_CHART_TYPES.map((type, index) => {
    const group = new THREE.Group();
    group.name = `statistic-${type}`;
    root.add(group);
    const animate: Array<(t: number) => void> = [];
    if (!['donut', 'pie', 'radar', 'heatmap', 'gauge'].includes(type))
      polyline(group, [-0.4, 0.28, 0, -0.4, -0.25, 0, 0.4, -0.25, 0], axes);

    if (type === 'columns' || type === 'histogram') {
      const count = type === 'histogram' ? 12 : 7;
      Array.from({ length: count }, (_, i) => {
        const mesh = bar(group, i % 3);
        const x = -0.34 + (i * 0.68) / (count - 1);
        animate.push((t) => {
          const h =
            type === 'histogram'
              ? 0.07 +
                0.35 *
                  Math.exp(-Math.pow((x - 0.1 * Math.sin(t * 0.38)) * 4, 2))
              : 0.08 + 0.37 * wave(t, i);
          mesh.scale.set(0.6 / count, h, 1);
          mesh.position.set(x, -0.24 + h / 2, 0);
        });
      });
    } else if (type === 'grouped-columns') {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
          const mesh = bar(group, j);
          animate.push((t) => {
            const h = 0.08 + 0.32 * wave(t, i + j * 2, 0.45 + j * 0.08);
            mesh.scale.set(0.039, h, 1);
            mesh.position.set(
              -0.3 + i * 0.2 + (j - 1) * 0.048,
              -0.24 + h / 2,
              0,
            );
          });
        }
    } else if (type === 'stacked-columns') {
      const bars = Array.from({ length: 5 }, () => [
        bar(group, 0),
        bar(group, 1),
        bar(group, 2),
      ]);
      animate.push((t) =>
        bars.forEach((parts, i) => {
          let y = -0.24;
          parts.forEach((mesh, j) => {
            const h = 0.065 + 0.075 * wave(t, i + j);
            mesh.scale.set(0.08, h, 1);
            mesh.position.set(-0.3 + i * 0.15, y + h / 2, 0);
            y += h;
          });
        }),
      );
    } else if (type === 'horizontal-bars') {
      for (let i = 0; i < 5; i++) {
        const mesh = bar(group, i);
        animate.push((t) => {
          const w = 0.2 + 0.48 * wave(t, i, 0.43);
          mesh.scale.set(w, 0.058, 1);
          mesh.position.set(-0.38 + w / 2, -0.19 + i * 0.095, 0);
        });
      }
    } else if (
      type === 'line' ||
      type === 'multiple-lines' ||
      type === 'area'
    ) {
      const count = 40;
      const seriesCount = type === 'multiple-lines' ? 3 : 1;
      for (let series = 0; series < seriesCount; series++) {
        const trace = polyline(group, Array(count * 3).fill(0), lines[series]);
        const head = marker(group, series, 0.023);
        animate.push((t) => {
          for (let i = 0; i < count; i++) {
            const x = -0.37 + (i * 0.74) / (count - 1);
            trace.setXYZ(i, x, signal(x, t, series), 0.025 + series * 0.008);
          }
          trace.needsUpdate = true;
          head.position.set(0.37, signal(0.37, t, series), 0.035);
        });
      }
      if (type === 'area') {
        const geometry = new THREE.BufferGeometry();
        const p = new Float32Array(count * 6),
          idx: number[] = [];
        for (let i = 0; i < count - 1; i++) {
          const a = i * 2;
          idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
        geometry.setIndex(idx);
        resources.push(geometry);
        group.add(new THREE.Mesh(geometry, filled));
        animate.push((t) => {
          for (let i = 0; i < count; i++) {
            const x = -0.37 + (i * 0.74) / (count - 1);
            p.set([x, -0.24, 0, x, signal(x, t, 0), 0], i * 6);
          }
          geometry.attributes.position.needsUpdate = true;
          geometry.computeBoundingSphere();
        });
      }
    } else if (type === 'donut' || type === 'pie') {
      const arcs = Array.from({ length: 5 }, (_, i) =>
        sector(group, i, type === 'donut' ? 0.145 : 0, 0.28),
      );
      animate.push((t) => {
        const weights = arcs.map((_, i) => 0.5 + wave(t, i, 0.25));
        const total = weights.reduce((a, b) => a + b, 0);
        let start = Math.PI / 2;
        arcs.forEach((draw, i) => {
          const end = start + (weights[i] / total) * Math.PI * 2;
          draw(start + 0.018, end - 0.018);
          start = end;
        });
      });
    } else if (type === 'scatter' || type === 'bubbles') {
      const count = type === 'scatter' ? 28 : 11;
      for (let i = 0; i < count; i++) {
        const point = marker(group, i, type === 'scatter' ? 0.014 : 0.03);
        animate.push((t) => {
          const x = -0.34 + (((i * 17) % count) * 0.68) / (count - 1);
          const y = x * 0.4 + (wave(t, i, 0.27) - 0.5) * 0.24;
          point.position.set(x, y, 0.025);
          if (type === 'bubbles')
            point.scale.setScalar(0.025 + 0.045 * wave(t, i, 0.33));
        });
      }
    } else if (type === 'radar') {
      for (let level = 1; level <= 3; level++) {
        const pts: number[] = [];
        for (let i = 0; i <= 6; i++) {
          const a = (i * Math.PI) / 3;
          pts.push(Math.cos(a) * level * 0.095, Math.sin(a) * level * 0.095, 0);
        }
        polyline(group, pts, axes);
      }
      const geometry = new THREE.BufferGeometry();
      const p = new Float32Array(7 * 3);
      const indices: number[] = [];
      for (let i = 1; i <= 6; i++) indices.push(0, i, i === 6 ? 1 : i + 1);
      geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
      geometry.setIndex(indices);
      resources.push(geometry);
      group.add(new THREE.Mesh(geometry, filled));
      const trace = polyline(group, Array(7 * 3).fill(0), lines[1]);
      animate.push((t) => {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const r = 0.13 + 0.14 * wave(t, i, 0.4);
          const x = Math.cos(a) * r,
            y = Math.sin(a) * r;
          p.set([x, y, 0.008], (i + 1) * 3);
          trace.setXYZ(i, x, y, 0.016);
          if (i === 0) trace.setXYZ(6, x, y, 0.016);
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.computeBoundingSphere();
        trace.needsUpdate = true;
      });
    } else if (type === 'heatmap') {
      const colorA = new THREE.Color(0x5d846e),
        colorB = new THREE.Color(0xf0dbac);
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 6; col++) {
          const material = new THREE.MeshPhysicalMaterial({
            roughness: 0.45,
            metalness: 0.25,
          });
          resources.push(material);
          const cell = new THREE.Mesh(unitBar, material);
          cell.position.set((col - 2.5) * 0.112, (row - 1.5) * 0.112, 0);
          group.add(cell);
          animate.push((t) => {
            const v = wave(t, row * 3 + col, 0.38);
            material.color.lerpColors(colorA, colorB, v);
            cell.scale.set(0.098, 0.098, 0.25 + v * 0.7);
          });
        }
    } else if (type === 'candlesticks') {
      for (let i = 0; i < 7; i++) {
        const body = bar(group, i % 2 ? 1 : 3);
        const wick = polyline(group, Array(6).fill(0), lines[i % 2 ? 1 : 3]);
        animate.push((t) => {
          const x = -0.33 + i * 0.11;
          const mid = -0.06 + 0.14 * Math.sin(i * 0.7 + t * 0.35);
          const h = 0.04 + 0.1 * wave(t, i, 0.31);
          body.scale.set(0.055, h, 0.75);
          body.position.set(x, mid, 0.018);
          wick.setXYZ(0, x, mid - h * 0.5 - 0.06, 0);
          wick.setXYZ(1, x, mid + h * 0.5 + 0.06, 0);
          wick.needsUpdate = true;
        });
      }
    } else {
      const background = sector(group, 2, 0.215, 0.25);
      background(Math.PI * 0.15, Math.PI * 0.85);
      const value = sector(group, 0, 0.215, 0.25);
      const needle = bar(group, 0);
      needle.scale.set(0.008, 0.22, 0.3);
      const pivot = new THREE.Group();
      pivot.add(needle);
      needle.position.y = 0.11;
      group.add(pivot);
      marker(group, 0, 0.024);
      animate.push((t) => {
        const v = 0.2 + 0.6 * wave(t, 1, 0.35);
        value(Math.PI * 0.15, Math.PI * 0.15 + Math.PI * 0.7 * v);
        pivot.rotation.z = Math.PI * 0.35 - Math.PI * 0.7 * v;
      });
    }
    const angle = index * 2.39996323 + 0.45;
    const radius = 0.7 + 2 * Math.sqrt(index / 15);
    const destination = new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.75,
      1.15 + Math.sin(index * 1.8) * 0.45,
    );
    return { type, group, destination, animate };
  });

  return {
    update(progress: number, time: number) {
      charts.forEach(({ group, destination, animate }, i) => {
        const growth = THREE.MathUtils.smoothstep(
          progress,
          0.025 + (i % 3) * 0.035,
          0.8,
        );
        group.visible = growth > 0.002;
        group.scale.setScalar(Math.max(0.00001, growth));
        group.position.copy(destination).multiplyScalar(0.25 + growth * 0.75);
        group.rotation.set(
          Math.sin(time * 0.13 + i) * 0.055,
          Math.sin(time * 0.1 + i) * 0.09,
          (1 - growth) * 0.18,
        );
        if (group.visible) animate.forEach((step) => step(time + i * 0.4));
      });
    },
    dispose() {
      parent.remove(root);
      resources.forEach((resource) => resource.dispose());
    },
  };
}
