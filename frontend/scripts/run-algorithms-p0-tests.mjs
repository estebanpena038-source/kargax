import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(frontendDir, '.algorithms-test-dist');
const tscPath = join(frontendDir, 'node_modules', 'typescript', 'bin', 'tsc');

if (!existsSync(tscPath)) {
  throw new Error('TypeScript no esta instalado. Ejecuta npm install en frontend/.');
}

rmSync(outputDir, { recursive: true, force: true });

const compile = spawnSync(
  process.execPath,
  [
    tscPath,
    '--target',
    'ES2020',
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--esModuleInterop',
    'true',
    '--skipLibCheck',
    'true',
    '--strict',
    'false',
    '--rootDir',
    join(frontendDir, 'src', 'algorithms'),
    '--outDir',
    outputDir,
    '--noEmit',
    'false',
    join(frontendDir, 'src', 'algorithms', 'p0.node-test.ts'),
  ],
  { cwd: frontendDir, stdio: 'inherit' }
);

if (compile.status !== 0) {
  process.exit(compile.status || 1);
}

const run = spawnSync(process.execPath, ['--test', join(outputDir, 'p0.node-test.js')], {
  cwd: frontendDir,
  stdio: 'inherit',
});

rmSync(outputDir, { recursive: true, force: true });

process.exit(run.status || 0);
