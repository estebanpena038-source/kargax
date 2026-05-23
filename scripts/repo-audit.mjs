#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const checks = [];

function check(key, ok, evidence = {}) {
  checks.push({ key, status: ok ? 'pass' : 'fail', evidence });
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { __error: error instanceof Error ? error.message : 'Could not read JSON' };
  }
}

const rootPackagePath = resolve(root, 'package.json');
const frontendPackagePath = resolve(root, 'frontend', 'package.json');
const rootPackage = readJson(rootPackagePath);
const frontendPackage = readJson(frontendPackagePath);

check('repo:root-package', existsSync(rootPackagePath), { path: 'package.json' });
check('repo:frontend-package', existsSync(frontendPackagePath), { path: 'frontend/package.json' });
check('repo:frontend-app-router', existsSync(resolve(root, 'frontend', 'src', 'app')), { path: 'frontend/src/app' });
check('repo:supabase-migrations', existsSync(resolve(root, 'supabase', 'migrations')), { path: 'supabase/migrations' });
check('repo:sprints-roadmap', existsSync(resolve(root, 'SPTRINTS')), { path: 'SPTRINTS' });
check('repo:design-manifest', existsSync(resolve(root, 'DESING.md')), { path: 'DESING.md' });

for (const scriptName of ['dev', 'build', 'typecheck', 'check', 'check:release']) {
  check(`repo:root-script:${scriptName}`, Boolean(rootPackage?.scripts?.[scriptName]), {
    command: rootPackage?.scripts?.[scriptName] || null,
  });
}

for (const scriptName of ['dev', 'build', 'typecheck', 'check:release', 'visual:qa']) {
  check(`repo:frontend-script:${scriptName}`, Boolean(frontendPackage?.scripts?.[scriptName]), {
    command: frontendPackage?.scripts?.[scriptName] || null,
  });
}

const failures = checks.filter((item) => item.status === 'fail');
const payload = {
  generated_at: new Date().toISOString(),
  status: failures.length ? 'fail' : 'pass',
  checks,
};

console.log(JSON.stringify(payload, null, 2));

if (failures.length) {
  process.exit(1);
}
