import { BufferAttribute, BufferGeometry } from 'three';

// YSM1: 16-byte uint32 header (magic, vertices, indices, reserved), followed
// by float32 positions/normals and uint32 triangle indices. No runtime meshing.
export function decodeEmblem(buffer: ArrayBuffer) {
  if (buffer.byteLength < 16 || buffer.byteLength % 4) throw new Error('Invalid emblem');
  const [magic, vertices, indices] = new Uint32Array(buffer, 0, 4);
  if (magic !== 0x314d5359 || !vertices || !indices || indices % 3 ||
      buffer.byteLength !== 16 + vertices * 24 + indices * 4) throw new Error('Invalid emblem');
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(buffer, 16, vertices * 3), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(buffer, 16 + vertices * 12, vertices * 3), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(buffer, 16 + vertices * 24, indices), 1));
  return geometry;
}
