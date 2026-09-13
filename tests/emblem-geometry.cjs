const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/emblem-geometry.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, require, Uint32Array, Float32Array });
const { decodeEmblem } = exportsObject;
let download = 0;
for (let i=0; i<4; i++) {
  const compressed = fs.readFileSync(path.join(__dirname, '../public/emblem-mesh-' + i + '.bin.gz'));
  download += compressed.length;
  const bytes = gunzipSync(compressed), buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const mesh = decodeEmblem(buffer), position = mesh.getAttribute('position'), normal = mesh.getAttribute('normal');
  assert.equal(position.count, normal.count);
  assert(mesh.index.count / 3 < 70000, 'Artwork stays within the desktop triangle budget');
  for (const index of mesh.index.array) assert(index < position.count);
  for (const value of position.array) assert(Number.isFinite(value) && Math.abs(value) <= 2.201);
  for (let vertex=0; vertex<normal.count; vertex++) {
    const length = Math.hypot(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
    assert(Math.abs(length-1) < .001, 'Surface lighting normals remain normalized');
  }
  mesh.computeBoundingBox();
  assert(Math.max(mesh.boundingBox.max.x-mesh.boundingBox.min.x, mesh.boundingBox.max.y-mesh.boundingBox.min.y) > 4.39);
  mesh.dispose();
  assert.throws(()=>decodeEmblem(buffer.slice(0, -4)), /Invalid emblem/);
}
assert(download < 3500000, 'All four cached meshes remain under 3.5 MB compressed');
assert.throws(()=>decodeEmblem(new ArrayBuffer(3)), /Invalid emblem/);
assert.throws(()=>decodeEmblem(new ArrayBuffer(16)), /Invalid emblem/);
console.log('All four prebuilt emblems: bounds, lighting, indices, corruption handling and download/render budgets pass.');
