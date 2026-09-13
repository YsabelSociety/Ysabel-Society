// Run only when the source SVG artwork changes. Generated meshes are committed
// so visitors never parse XML or triangulate the artwork on their UI thread.
// Requires Playwright (or PLAYWRIGHT_MODULE pointing to an installed module).
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const server = http.createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://localhost').pathname;
    if (name === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script>');
      return;
    }
    const file = name.startsWith('/three/')
      ? path.join(root, 'node_modules/three', name.slice(7))
      : /^\/emblem-vector-[0-3]\.svg$/.test(name) ? path.join(root, 'public', name) : null;
    if (!file) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', name.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port);
  const results = [];
  for (let i = 0; i < 4; i++) {
    const result = await page.evaluate(async i => {
      const THREE = await import('three');
      const { SVGLoader } = await import('/three/examples/jsm/loaders/SVGLoader.js');
      const { mergeVertices } = await import('/three/examples/jsm/utils/BufferGeometryUtils.js');
      const xml = await (await fetch('/emblem-vector-' + i + '.svg')).text();
      const source = new SVGLoader().parse(xml).paths.flatMap(p => SVGLoader.createShapes(p));
      // The supplied outlines contain thousands of almost-collinear points.
      // Keep every contour/hole, with a maximum 0.15 source-pixel deviation.
      const simplifyOpen = (points, tolerance) => {
        if (points.length < 3) return points;
        const keep = new Set([0, points.length - 1]), stack = [[0, points.length - 1]];
        while (stack.length) {
          const [a, b] = stack.pop(), first = points[a], last = points[b];
          const dx = last.x - first.x, dy = last.y - first.y, length = dx * dx + dy * dy;
          let max = tolerance * tolerance, selected = -1;
          for (let j = a + 1; j < b; j++) {
            const p = points[j], t = length ? Math.max(0, Math.min(1, ((p.x-first.x)*dx+(p.y-first.y)*dy)/length)) : 0;
            const distance = (p.x-first.x-t*dx)**2+(p.y-first.y-t*dy)**2;
            if (distance > max) { max = distance; selected = j; }
          }
          if (selected !== -1) { keep.add(selected); stack.push([a, selected], [selected, b]); }
        }
        return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
      };
      let originalPoints = 0, meshPoints = 0;
      const contour = points => {
        if (points[0].equals(points.at(-1))) points = points.slice(0, -1);
        originalPoints += points.length;
        let split = 1;
        for (let j=2; j<points.length; j++)
          if (points[j].distanceToSquared(points[0]) > points[split].distanceToSquared(points[0])) split = j;
        const simplified = [
          ...simplifyOpen(points.slice(0, split+1), .15).slice(0, -1),
          ...simplifyOpen([...points.slice(split), points[0]], .15).slice(0, -1),
        ];
        const result = simplified.length < 3 ? points : simplified;
        meshPoints += result.length;
        return result;
      };
      const shapes = source.map(shape => {
        const points = shape.extractPoints(2);
        const result = new THREE.Shape(contour(points.shape));
        result.holes = points.holes.map(hole => new THREE.Path(contour(hole)));
        return result;
      });
      // The vectors have sub-pixel quadratic segments already. Two samples per
      // segment preserve their outline without tessellating each pixel eight times.
      const raw = new THREE.ExtrudeGeometry(shapes, { depth: 8, steps: 1,
        bevelEnabled: true, bevelThickness: .5, bevelSize: .25, bevelSegments: 1, curveSegments: 2 });
      raw.center(); raw.rotateX(Math.PI); raw.computeBoundingBox();
      const size = raw.boundingBox.getSize(new THREE.Vector3());
      raw.scale(...Array(3).fill(4.4 / Math.max(size.x, size.y)));
      raw.deleteAttribute('uv');
      const geometry = mergeVertices(raw, .00001);
      const positions = geometry.getAttribute('position').array;
      const normals = geometry.getAttribute('normal').array;
      const indices = new Uint32Array(geometry.index.array);
      const buffer = new ArrayBuffer(16 + positions.byteLength + normals.byteLength + indices.byteLength);
      new Uint32Array(buffer, 0, 4).set([0x314d5359, positions.length / 3, indices.length, 0]);
      new Float32Array(buffer, 16, positions.length).set(positions);
      new Float32Array(buffer, 16 + positions.byteLength, normals.length).set(normals);
      new Uint32Array(buffer, 16 + positions.byteLength + normals.byteLength).set(indices);
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let start = 0; start < bytes.length; start += 32768)
        binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
      return { base64: btoa(binary), originalPoints, meshPoints, vertices: positions.length / 3, triangles: indices.length / 3, bytes: buffer.byteLength };
    }, i);
    const compressed = gzipSync(Buffer.from(result.base64, 'base64'), { level: 9 });
    await fs.writeFile(path.join(root, 'public', 'emblem-mesh-' + i + '.bin.gz'), compressed);
    result.downloadBytes = compressed.byteLength;
    delete result.base64;
    results.push({ emblem: i, ...result });
  }
  console.log(JSON.stringify(results));
} finally { await browser?.close(); server.close(); }
