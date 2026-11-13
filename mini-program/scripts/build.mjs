import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(projectRoot, 'src');
const outputRoot = join(projectRoot, 'dist');
const assetExtensions = new Set(['.json', '.wxml', '.wxss']);
const require = createRequire(import.meta.url);
const tscPath = require.resolve('typescript/bin/tsc');

await rm(outputRoot, { recursive: true, force: true });
const result = spawnSync(process.execPath, [tscPath, '-p', 'tsconfig.build.json'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

async function copyAssets(currentPath) {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(currentPath, entry.name);
    const relativePath = sourcePath.slice(sourceRoot.length + 1);
    const outputPath = join(outputRoot, relativePath);

    if (entry.isDirectory()) {
      await copyAssets(sourcePath);
      continue;
    }

    if (!assetExtensions.has(extname(entry.name))) {
      continue;
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(sourcePath, outputPath);
  }
}

await copyAssets(sourceRoot);
