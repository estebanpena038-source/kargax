#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const findings = [];
const ignoredDirs = new Set(['.git', '.next', 'node_modules']);
const scannedExtensions = new Set(['.md', '.mjs', '.js', '.ts', '.tsx', '.json', '.sql']);
const secretPatterns = [
  { key: 'mercadopago-access-token', pattern: /APP_USR-[A-Za-z0-9_-]{20,}/ },
  { key: 'supabase-service-role-jwt', pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { key: 'internal-api-key-assignment', pattern: /INTERNAL_API_KEY\s*=\s*['"]?[A-Za-z0-9_-]{16,}/i },
  { key: 'webhook-secret-assignment', pattern: /MERCADOPAGO_WEBHOOK_SECRET\s*=\s*['"]?[A-Za-z0-9_-]{16,}/i },
];

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

    const extension = entry.includes('.') ? `.${entry.split('.').pop()}` : '';
    if (scannedExtensions.has(extension)) {
      output.push(fullPath);
    }
  }

  return output;
}

for (const file of listFiles(root)) {
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
