import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../apps/contentpreview/package.json', import.meta.url));
const sharp = require('sharp');
const output = new URL('../public/contentpreview-icons/', import.meta.url);
await mkdir(output, { recursive: true });
// Preserve the supplied emblem's contours through its original alpha channel.
const alpha = await sharp(fileURLToPath(new URL('../apps/contentpreview/public/ysabel-logo-mark.png', import.meta.url)))
  .ensureAlpha().extractChannel('alpha').png().toBuffer();
const mask = `data:image/png;base64,${alpha.toString('base64')}`;
for (const size of [180, 192, 512]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><defs><mask id="mark"><image href="${mask}" x="-128" y="40" width="768" height="432"/></mask></defs><rect width="512" height="512" fill="#293024"/><rect width="512" height="512" fill="#d6d7d1" mask="url(#mark)"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(`olive-silver-${size}.png`, output)));
}
