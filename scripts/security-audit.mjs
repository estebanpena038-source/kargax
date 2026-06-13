#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const findings = [];
const ignoredDirs = new Set(['.git', '.next', '.vercel', 'node_modules']);
const scannedExtensions = new Set(['.md', '.mjs', '.js', '.ts', '.tsx', '.json', '.sql']);
const secretPatterns = [
  { key: 'mercadopago-access-token', pattern: /APP_USR-[A-Za-z0-9_-]{20,}/ },
  { key: 'supabase-service-role-jwt', pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { key: 'internal-api-key-assignment', pattern: /INTERNAL_API_KEY\s*=\s*['"]?[A-Za-z0-9_-]{16,}/i },
  { key: 'webhook-secret-assignment', pattern: /MERCADOPAGO_WEBHOOK_SECRET\s*=\s*['"]?[A-Za-z0-9_-]{16,}/i },
];

function shouldScanFile(file) {
  const fileName = file.split(/[\\/]/).pop() || '';
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
  return scannedExtensions.has(extension);
}

function listFiles(dir, output = []) {
  if (!existsSync(dir)) {
    return output;
  }

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!ignoredDirs.has(entry)) {
        listFiles(fullPath, output);
      }
      continue;
    }

    if (shouldScanFile(entry)) {
      output.push(fullPath);
    }
  }

  return output;
}

function listGitVisibleFiles() {
  try {
    const output = execFileSync(
      'git',
      ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );

    return output
      .split('\0')
      .filter(Boolean)
      .map((file) => join(root, file))
      .filter((file) => existsSync(file) && statSync(file).isFile() && shouldScanFile(file));
  } catch {
    return null;
  }
}

const filesToScan = listGitVisibleFiles() || listFiles(root);

for (const file of filesToScan) {
  const relativePath = relative(root, file).replaceAll('\\', '/');

  if (relativePath.includes('package-lock.json')) {
    continue;
  }

  const source = readFileSync(file, 'utf8');
  for (const rule of secretPatterns) {
    if (rule.pattern.test(source)) {
      findings.push({ rule: rule.key, file: relativePath });
    }
  }
}

const payload = {
  generated_at: new Date().toISOString(),
  status: findings.length ? 'fail' : 'pass',
  findings,
};

console.log(JSON.stringify(payload, null, 2));

if (findings.length) {
  process.exit(1);
}
