import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SENSITIVE_ROOTS = [
  'frontend/src/app/api/admin',
  'frontend/src/app/api/staff',
  'frontend/src/app/api/business/fleet',
  'frontend/src/app/api/billing',
  'frontend/src/app/api/reports',
  'frontend/src/app/api/offers',
  'frontend/src/app/api/wallet',
  'frontend/src/app/api/payments',
  'frontend/src/app/api/jobs',
  'frontend/src/app/api/warehouses',
  'frontend/src/app/api/tracking',
  'frontend/src/app/api/support',
];

const SOURCE_ALLOWLIST = new Set([
  'frontend/src/lib/business-roles.ts',
  'frontend/src/lib/server/role-policy.ts',
  'frontend/src/lib/server/internal-admins.ts',
  'frontend/src/lib/server/staff.ts',
  'frontend/src/lib/server/warehouses.ts',
  'frontend/src/lib/server/holding.ts',
]);

const PUBLIC_MUTATION_ALLOWLIST = new Set([
  'frontend/src/app/api/support/requests/route.ts',
]);

const ROUTE_GUARD_PATTERNS = [
  /\brequireAuthenticatedRoute\s*\(/,
  /\brequireAdminRoute\s*\(/,
  /\brequireAal2Route\s*\(/,
  /\brequireFounderCeoRoute\s*\(/,
  /\brequireInternalAdminCapability\s*\(/,
  /\brequireStaffCapability\s*\(/,
  /\brequireInternalApiKeyRoute\s*\(/,
  /\bvalidateWebhookSignature\s*\(/,
  /\bsafelyCompareSecrets\s*\(/,
  /\bgetInternalApiKeyFromRequest\s*\(/,
  /\bresolveBusinessRolePolicy\s*\(/,
  /\bensureWarehouseAccess\s*\(/,
  /\bresolveBusinessAccessContext\s*\(/,
  /\bNODE_ENV\s*!==\s*['"]production['"]/,
  /\bNODE_ENV\s*===\s*['"]production['"]/,
];

const MUTATION_EXPORT_PATTERN = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g;
const SERVICE_ROLE_PATTERNS = [
  /\bgetSupabaseAdmin\s*\(/,
  /\bcreateClient\s*\(/,
  /\bsupabaseAdmin\b/,
];

const WARNING_PATTERNS = [
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
  {
    name: 'profile.user_type manual gate',
    pattern: /\bprofile\??\.user_type\s*(?:={2,3}|!==|!=)/,
  },
  {
    name: 'profile.user_type manual gate',
    pattern: /\bprofile\.user_type\s*(?:={2,3}|!==|!=)/,
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

function hasRouteGuard(source) {
  return ROUTE_GUARD_PATTERNS.some((pattern) => pattern.test(source));
}

function hasMutationExport(source) {
  MUTATION_EXPORT_PATTERN.lastIndex = 0;
  return MUTATION_EXPORT_PATTERN.test(source);
}

function usesServiceRoleSurface(source) {
  return SERVICE_ROLE_PATTERNS.some((pattern) => pattern.test(source));
}

function pushPatternWarnings({ source, lines, relativePath, warnings }) {
  for (const check of WARNING_PATTERNS) {
    lines.forEach((line, index) => {
      if (check.pattern.test(line)) {
        warnings.push({
          file: relativePath,
          line: index + 1,
          check: check.name,
          source: line.trim(),
        });
      }
    });
  }
}

const findings = [];
const warnings = [];

for (const root of SENSITIVE_ROOTS) {
  const absoluteRoot = path.join(ROOT, root);
  for (const file of walkFiles(absoluteRoot)) {
    const relativePath = toPosix(path.relative(ROOT, file));
    if (SOURCE_ALLOWLIST.has(relativePath)) continue;

    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    const routeGuarded = hasRouteGuard(source);
    const mutationRoute = hasMutationExport(source);
    const publicMutationAllowed = PUBLIC_MUTATION_ALLOWLIST.has(relativePath);

    if (mutationRoute && !routeGuarded && !publicMutationAllowed) {
      findings.push({
        file: relativePath,
        check: 'mutating sensitive API route without recognized guard',
        source: 'POST/PUT/PATCH/DELETE export requires auth, admin, AAL2, webhook signature, internal key, business policy, warehouse access, or dev-only guard.',
      });
    }

    if (usesServiceRoleSurface(source) && !routeGuarded && !publicMutationAllowed) {
      findings.push({
        file: relativePath,
        check: 'service-role surface without recognized guard',
        source: 'getSupabaseAdmin/createClient/supabaseAdmin must be behind a route guard or explicit allowlist.',
      });
    }

    pushPatternWarnings({ source, lines, relativePath, warnings });
  }
}

if (findings.length) {
  console.error('Role policy drift detected in sensitive routes.');
  for (const finding of findings) {
    console.error(`- ${finding.file} ${finding.check}`);
    console.error(`  ${finding.source}`);
  }
  console.error('Use frontend/src/lib/server/role-policy.ts, route-auth guards, verified webhooks, or internal-key helpers.');
  process.exit(1);
}

if (warnings.length) {
  console.warn(`Role policy warnings: ${warnings.length} legacy/manual gates found.`);
  for (const warning of warnings.slice(0, 25)) {
    console.warn(`- ${warning.file}:${warning.line} ${warning.check}`);
    console.warn(`  ${warning.source}`);
  }
  if (warnings.length > 25) {
    console.warn(`... ${warnings.length - 25} additional warnings omitted.`);
  }
  console.warn('Warnings do not fail this gate yet; migrate these routes to role-policy.ts incrementally.');
}

console.log('Role policy check passed.');
