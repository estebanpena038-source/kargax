#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');
const repoRoot = resolve(process.cwd());
const overlayRoot = join(packageRoot, 'overlay');

const filesToCopy = [
  'frontend/src/lib/last-mile/copy.ts',
  'frontend/src/components/last-mile/LastMileExplainer.tsx',
  'frontend/src/components/last-mile/LastMileDashboard.tsx',
  'frontend/src/components/last-mile/LastMileEmptyState.tsx',
  'frontend/src/components/layouts/SIDEBAR/navigation.tsx',
];

function assertRepoRoot() {
  const packageJson = join(repoRoot, 'package.json');
  const frontendPackageJson = join(repoRoot, 'frontend', 'package.json');
  if (!existsSync(packageJson) || !existsSync(frontendPackageJson)) {
    throw new Error('Ejecuta este script desde la raíz del repo kargax, donde existen package.json y frontend/package.json.');
  }
}

function copyOverlayFile(relativePath) {
  const source = join(overlayRoot, relativePath);
  const target = join(repoRoot, relativePath);
  if (!existsSync(source)) {
    throw new Error(`No existe archivo overlay: ${source}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(source, 'utf8'), 'utf8');
  console.log(`OK ${relativePath}`);
}

assertRepoRoot();
for (const file of filesToCopy) copyOverlayFile(file);

console.log('\nListo. Ahora corre:');
console.log('npm run lint');
console.log('npm run typecheck');
console.log('npm run build');
