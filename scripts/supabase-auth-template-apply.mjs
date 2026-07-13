#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DEFAULT_BASE_URL = 'https://kargax.online';
const DEFAULT_STAGING_URL = 'https://kargax-staging.vercel.app';
const DEFAULT_ENV_FILES = [
  'frontend/.env.example',
  'frontend/.vercel/.env.production.local',
  'frontend/.vercel/.env.preview.local',
  'frontend/.env.production.check',
  'frontend/.env.local',
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
    projectRef: env.PROJECT_REF || env.SUPABASE_PROJECT_REF || null,
    baseUrl: env.KARGAX_CANONICAL_APP_URL || env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL,
    stagingUrl: env.KARGAX_STAGING_APP_URL || DEFAULT_STAGING_URL,
    extraOrigins: (env.KARGAX_EXTRA_AUTH_ORIGINS || '').split(/[\s,]+/).filter(Boolean),
    dryRun: false,
    includeSmtp: false,
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
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--include-smtp') {
      args.includeSmtp = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run supabase:auth-template-apply -- --project-ref <project-ref>
  npm run supabase:auth-template-apply -- --project-ref <project-ref> --dry-run

Environment:
  SUPABASE_ACCESS_TOKEN is required unless --dry-run is used.
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS enable SMTP when --include-smtp is used.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.projectRef) {
    const projectRef = projectRefFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
    if (projectRef) {
      args.projectRef = projectRef;
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

function readTemplate(relativeFile) {
  return fs.readFileSync(path.resolve(ROOT, relativeFile), 'utf8');
}

function buildRedirectUrls(baseUrl, stagingUrl, extraOrigins = []) {
  const origins = [baseUrl, stagingUrl, ...extraOrigins].map(normalizeOrigin);
  const paths = ['/auth/callback', '/auth/reset-password', '/auth/invite/accept'];
  return [...new Set(origins.flatMap((origin) => paths.map((item) => `${origin}${item}`)))];
}

function buildPayload(args, currentConfig = {}) {
  const productionOrigin = normalizeOrigin(args.baseUrl);
  const redirectUrls = buildRedirectUrls(args.baseUrl, args.stagingUrl, args.extraOrigins);
  const payload = {
    mailer_autoconfirm: false,
    mailer_subjects_confirmation: 'Confirma tu correo en KargaX',
    mailer_templates_confirmation_content: readTemplate('supabase/templates/confirm-signup.html'),
    mailer_subjects_invite: 'Tu acceso empresarial a KargaX esta listo',
    mailer_templates_invite_content: readTemplate('supabase/templates/invite.html'),
    mailer_subjects_magic_link: 'Entra a KargaX',
    mailer_templates_magic_link_content: readTemplate('supabase/templates/magic-link.html'),
    mailer_subjects_recovery: 'Restablece tu acceso a KargaX',
    mailer_templates_recovery_content: readTemplate('supabase/templates/recovery.html'),
  };

  if ('site_url' in currentConfig) {
    payload.site_url = productionOrigin;
  }

  if ('uri_allow_list' in currentConfig) {
    payload.uri_allow_list = redirectUrls.join(',');
  } else if ('additional_redirect_urls' in currentConfig) {
    payload.additional_redirect_urls = redirectUrls;
  }

  if (args.includeSmtp) {
    const smtpHost = env.SMTP_HOST || 'smtp.resend.com';
    const smtpPort = Number(env.SMTP_PORT || 587);
    const smtpUser = env.SMTP_USER || 'resend';
    const smtpPass = env.SMTP_PASS || env.RESEND_API_KEY;
    const smtpAdminEmail = env.SMTP_ADMIN_EMAIL || 'noreply@auth.kargax.com';
    const smtpSenderName = env.SMTP_SENDER_NAME || 'KargaX';

    if (!smtpPass) {
      throw new Error('SMTP_PASS or RESEND_API_KEY is required with --include-smtp');
    }

    Object.assign(payload, {
      external_email_enabled: true,
      mailer_secure_email_change_enabled: true,
      smtp_admin_email: smtpAdminEmail,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_user: smtpUser,
      smtp_pass: smtpPass,
      smtp_sender_name: smtpSenderName,
    });
  }

  return { payload, redirectUrls, productionOrigin };
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const accessToken = env.SUPABASE_ACCESS_TOKEN;

  if (!args.projectRef) {
    throw new Error('Missing PROJECT_REF/SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL');
  }

  let currentConfig = {};
  if (!args.dryRun) {
    if (!accessToken) {
      throw new Error('SUPABASE_ACCESS_TOKEN is required to apply Supabase Auth templates');
    }

    currentConfig = await requestJson(
      `https://api.supabase.com/v1/projects/${args.projectRef}/config/auth`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  }

  const { payload, redirectUrls, productionOrigin } = buildPayload(args, currentConfig);
  const redactedPayload = {
    ...payload,
    smtp_pass: payload.smtp_pass ? '[redacted]' : undefined,
  };

  if (args.dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      projectRef: args.projectRef,
      productionOrigin,
      redirectUrls,
      payloadKeys: Object.keys(payload).sort(),
    }, null, 2));
    return;
  }

  await requestJson(`https://api.supabase.com/v1/projects/${args.projectRef}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log(JSON.stringify({
    ok: true,
    projectRef: args.projectRef,
    productionOrigin,
    redirectUrls,
    appliedKeys: Object.keys(redactedPayload).filter((key) => redactedPayload[key] !== undefined).sort(),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
