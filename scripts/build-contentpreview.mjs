import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = fileURLToPath(new URL('../apps/contentpreview/', import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this build through npm run build.');
const isPnpm = path.basename(npm).toLowerCase().includes('pnpm');
const installArgs = isPnpm ? ['install', '--no-frozen-lockfile', '--ignore-scripts'] : ['ci', '--include=dev', '--no-audit', '--no-fund'];
for (const args of [installArgs, ['run', 'build']]) {
  const result = spawnSync(process.execPath, [npm, ...args], { cwd: directory, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
