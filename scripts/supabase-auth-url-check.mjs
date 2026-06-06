#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DEFAULT_ENV_FILES = [
  'frontend/.env.example',
  'frontend/.vercel/.env.production.local',
  'frontend/.vercel/.env.preview.local',
  'frontend/.env.production.check',
  'frontend/.env.local',
];

function parseArgs(argv) {
  const args = {
    baseUrl: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      args.baseUrl = argv[++index];
    } else if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run supabase:auth-url-check
  npm run supabase:auth-url-check -- --base-url https://kargax.com

Options:
  --base-url <url>  Expected public app URL for generated auth redirects
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const result = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    result[line.slice(0, separatorIndex).trim()] = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }

  return result;
}

function loadEnv() {
  return {
    ...DEFAULT_ENV_FILES.reduce((loaded, relativeFile) => ({
      ...loaded,
      ...parseEnvFile(path.resolve(ROOT, relativeFile)),
    }), {}),
    ...process.env,
  };
}

function isLocalhostUrl(value) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return value.includes('localhost');
  }
}

function normalizeBaseUrl(value) {
  if (!value) {
    return null;
  }

  const parsed = new URL(value);

  if (parsed.protocol !== 'https:') {
    throw new Error('Auth redirect base URL must use HTTPS for production checks');
  }

  return parsed.origin;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${text.slice(0, 240)}`);
  }

  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const expectedBaseUrl = normalizeBaseUrl(
    args.baseUrl || env.KARGAX_CANONICAL_APP_URL || env.NEXT_PUBLIC_APP_URL || 'https://kargax.com'
  );
  const redirectChecks = [
    { type: 'magiclink', path: '/auth/invite/accept' },
    { type: 'magiclink', path: '/auth/callback' },
    { type: 'recovery', path: '/auth/reset-password' },
    { type: 'invite', path: '/auth/invite/accept' },
  ];

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  const authHeaders = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
  };

  const profiles = await requestJson(
    `${supabaseUrl}/rest/v1/user_profiles?select=email&email=not.is.null&limit=1`,
    { headers: authHeaders }
  );
  const email = profiles?.[0]?.email;

  if (!email) {
    throw new Error('No user_profiles.email row available for auth URL diagnostics');
  }

  const results = [];

  for (const check of redirectChecks) {
    const expectedRedirectTo = `${expectedBaseUrl}${check.path}`;
    const targetEmail = check.type === 'invite'
      ? `auth-url-check-${Date.now()}@example.invalid`
      : email;
    const generated = await requestJson(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: check.type,
        email: targetEmail,
        options: {
          redirectTo: expectedRedirectTo,
        },
      }),
    });

    const actionLink = generated?.action_link || generated?.properties?.action_link;
    if (!actionLink) {
      throw new Error(`Supabase did not return an action_link for ${check.type} ${check.path}`);
    }

    const parsedActionLink = new URL(actionLink);
    const encodedRedirect = parsedActionLink.searchParams.get('redirect_to')
      || parsedActionLink.searchParams.get('redirectTo')
      || '';
    const actualRedirectTo = encodedRedirect ? decodeURIComponent(encodedRedirect) : null;

    results.push({
      authLinkType: check.type,
      path: check.path,
      supabaseAuthHost: parsedActionLink.host,
      requestedRedirectTo: expectedRedirectTo,
      generatedRedirectTo: actualRedirectTo,
      generatedRedirectHost: actualRedirectTo ? new URL(actualRedirectTo).host : null,
      redirectsToLocalhost: isLocalhostUrl(actualRedirectTo || ''),
      matchesRequestedRedirect: actualRedirectTo === expectedRedirectTo,
    });
  }

  console.log(JSON.stringify({
    expectedBaseUrl,
    checks: results,
  }, null, 2));

  if (results.some((result) => result.redirectsToLocalhost || !result.matchesRequestedRedirect)) {
    console.error(
      'Supabase Auth URL configuration is not accepting the production redirect. ' +
      'Update Auth > URL Configuration: Site URL and Redirect URLs.'
    );
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
