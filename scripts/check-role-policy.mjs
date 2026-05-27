import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SENSITIVE_ROOTS = [
  'frontend/src/app/api/business/fleet',
  'frontend/src/app/api/billing',
  'frontend/src/app/api/reports',
  'frontend/src/app/api/offers',
];

const ALLOWLIST = new Set([
  'frontend/src/lib/business-roles.ts',
  'frontend/src/lib/server/role-policy.ts',
  'frontend/src/lib/server/warehouses.ts',
  'frontend/src/lib/server/holding.ts',
]);

const FORBIDDEN_PATTERNS = [
  {
    name: 'businessAccess.isOwner manual gate',
    pattern: /\bbusinessAccess\.isOwner\b/,
  },
  {
    name: 'teamMember.role manual gate',
    pattern: /\bteamMember\??\.role\s*(?:={2,3}|!==|!=)/,
  },
  {
    name: 'direct business role capabilities in sensitive route',
    pattern: /\bgetBusinessRoleCapabilities\s*\(/,
  },
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(absolutePath);
    if (!entry.isFile()) return [];
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [absolutePath];
  });
}

const findings = [];

for (const root of SENSITIVE_ROOTS) {
  const absoluteRoot = path.join(ROOT, root);
  for (const file of walkFiles(absoluteRoot)) {
    const relativePath = toPosix(path.relative(ROOT, file));
    if (ALLOWLIST.has(relativePath)) continue;

    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);

    for (const check of FORBIDDEN_PATTERNS) {
      lines.forEach((line, index) => {
        if (check.pattern.test(line)) {
          findings.push({
            file: relativePath,
            line: index + 1,
            check: check.name,
            source: line.trim(),
          });
        }
      });
    }
  }
}

if (findings.length) {
  console.error('Role policy drift detected in sensitive routes.');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.check}`);
    console.error(`  ${finding.source}`);
  }
  console.error('Use frontend/src/lib/server/role-policy.ts instead of manual business-role gates.');
  process.exit(1);
}

console.log('Role policy check passed.');
