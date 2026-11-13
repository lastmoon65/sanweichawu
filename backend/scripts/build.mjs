import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const tscPath = require.resolve('typescript/bin/tsc');

await rm(join(projectRoot, 'dist'), { recursive: true, force: true });
const result = spawnSync(process.execPath, [tscPath, '-p', 'tsconfig.build.json'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
