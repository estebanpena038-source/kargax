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
const AUTH_PATHS = ['/auth/callback', '/auth/reset-password', '/auth/invite/accept'];
const TEMPLATE_CHECKS = [
  ['mailer_templates_confirmation_content', 'type=email'],
  ['mailer_templates_invite_content', 'type=invite'],
  ['mailer_templates_magic_link_content', 'type=magiclink'],
  ['mailer_templates_recovery_content', 'type=recovery'],
];

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

const env = {
  ...DEFAULT_ENV_FILES.reduce((loaded, relativeFile) => ({
    ...loaded,
    ...parseEnvFile(path.resolve(ROOT, relativeFile)),
  }), {}),
  ...process.env,
};

function parseArgs(argv) {
  const args = {
    projectRef: env.PROJECT_REF || env.SUPABASE_PROJECT_REF || projectRefFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL),
    baseUrl: env.KARGAX_CANONICAL_APP_URL || env.NEXT_PUBLIC_APP_URL || 'https://kargax.com',
    stagingUrl: env.KARGAX_STAGING_APP_URL || 'https://kargax-staging.vercel.app',
    extraOrigins: (env.KARGAX_EXTRA_AUTH_ORIGINS || '').split(/[\s,]+/).filter(Boolean),
    requireSmtp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-ref') {
      args.projectRef = argv[++index];
    } else if (arg.startsWith('--project-ref=')) {
      args.projectRef = arg.slice('--project-ref='.length);
    } else if (arg === '--base-url') {
      args.baseUrl = argv[++index];
    } else if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
    } else if (arg === '--staging-url') {
      args.stagingUrl = argv[++index];
    } else if (arg.startsWith('--staging-url=')) {
      args.stagingUrl = arg.slice('--staging-url='.length);
    } else if (arg === '--extra-origin') {
      args.extraOrigins.push(argv[++index]);
    } else if (arg.startsWith('--extra-origin=')) {
      args.extraOrigins.push(arg.slice('--extra-origin='.length));
    } else if (arg === '--require-smtp') {
      args.requireSmtp = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run supabase:auth-config-check -- --project-ref <project-ref> --base-url https://kargax.com
  npm run supabase:auth-config-check -- --project-ref <project-ref> --require-smtp

Requires SUPABASE_ACCESS_TOKEN.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function projectRefFromSupabaseUrl(value) {
  if (!value) return null;

  try {
    const host = new URL(value).host;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function normalizeOrigin(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error(`Auth URL must use HTTPS: ${value}`);
  }
  return parsed.origin;
}

function buildExpectedRedirects(args) {
  const origins = [args.baseUrl, args.stagingUrl, ...args.extraOrigins].map(normalizeOrigin);
  return [...new Set(origins.flatMap((origin) => AUTH_PATHS.map((item) => `${origin}${item}`)))];
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
    throw new Error(`${response.status} ${text.slice(0, 500)}`);
  }

  return json;
}

function listRedirects(config) {
  const raw = String(config.uri_allow_list || '');
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function result(gate, ok, evidence) {
  return {
    gate,
    status: ok ? 'pass' : 'fail',
    evidence,
  };
}

function checkTemplate(config, field, expectedType) {
  const html = String(config[field] || '');
  return result(`template:${field}`, (
    html.includes('{{ .RedirectTo }}')
    && html.includes('{{ .TokenHash }}')
    && html.includes(expectedType)
    && !html.includes('.ConfirmationURL')
    && !html.includes('powered by Supabase')
    && !html.includes('Confirm your email address')
  ), {
    hasRedirectTo: html.includes('{{ .RedirectTo }}'),
    hasTokenHash: html.includes('{{ .TokenHash }}'),
    hasExpectedType: html.includes(expectedType),
    usesConfirmationUrl: html.includes('.ConfirmationURL'),
    hasSupabaseFooter: html.includes('powered by Supabase'),
    hasDefaultEnglishCopy: html.includes('Confirm your email address'),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = env.SUPABASE_ACCESS_TOKEN;

  if (!args.projectRef) {
    throw new Error('Missing PROJECT_REF/SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN is required to check remote Supabase Auth config');
  }

  const config = await requestJson(`https://api.supabase.com/v1/projects/${args.projectRef}/config/auth`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const productionOrigin = normalizeOrigin(args.baseUrl);
  const expectedRedirects = buildExpectedRedirects(args);
  const actualRedirects = listRedirects(config);
  const missingRedirects = expectedRedirects.filter((url) => !actualRedirects.includes(url));
  const checks = [
    result('auth:site-url', config.site_url === productionOrigin, {
      expected: productionOrigin,
      actual: config.site_url || null,
    }),
    result('auth:redirect-allowlist', missingRedirects.length === 0, {
      expectedCount: expectedRedirects.length,
      missingRedirects,
      actualCount: actualRedirects.length,
    }),
    result('auth:mailer-autoconfirm', config.mailer_autoconfirm === false, {
      mailerAutoconfirm: config.mailer_autoconfirm,
    }),
    ...TEMPLATE_CHECKS.map(([field, expectedType]) => checkTemplate(config, field, expectedType)),
  ];

  if (args.requireSmtp) {
    checks.push(result('auth:smtp', Boolean(
      config.smtp_host
      && config.smtp_port
      && config.smtp_user
      && config.smtp_sender_name
      && config.smtp_admin_email
    ), {
      smtpHostConfigured: Boolean(config.smtp_host),
      smtpPortConfigured: Boolean(config.smtp_port),
      smtpUserConfigured: Boolean(config.smtp_user),
      smtpSenderNameConfigured: Boolean(config.smtp_sender_name),
      smtpAdminEmailConfigured: Boolean(config.smtp_admin_email),
    }));
  }

  const failed = checks.filter((check) => check.status !== 'pass');
  console.log(JSON.stringify({
    projectRef: args.projectRef,
    status: failed.length ? 'fail' : 'pass',
    checks,
  }, null, 2));

  if (failed.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
