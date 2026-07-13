#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const cwd = resolve(process.cwd());
const root = existsSync(resolve(cwd, 'package.json')) && existsSync(resolve(cwd, 'src'))
  ? cwd
  : resolve(cwd, 'frontend');
const repoRoot = root.endsWith('frontend') ? resolve(root, '..') : root;
const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
];
const requiredDbShapes = [
  {
    gate: 'db:feature-flags',
    table: 'feature_flags',
    columns: ['key', 'enabled', 'scope', 'country_code', 'payload'],
  },
  {
    gate: 'db:wallet-payout-methods',
    table: 'payout_methods',
    columns: ['id', 'user_id', 'method', 'account_holder_name', 'status'],
  },
  {
    gate: 'db:wallet-payout-attempts',
    table: 'payout_attempts',
    columns: ['id', 'user_id', 'wallet_transaction_id', 'method', 'status', 'provider', 'idempotency_key', 'provider_reference'],
  },
  {
    gate: 'db:wallet2-transaction-rails',
    table: 'transactions',
    columns: ['id', 'wallet_id', 'money_rail', 'source_system', 'payout_eligible', 'payout_attempt_id', 'locked_for_payout', 'external_proof_only', 'pending_balance_before', 'pending_balance_after'],
  },
  {
    gate: 'db:wallet2-payout-attempts',
    table: 'payout_attempts',
    columns: ['id', 'source_kind', 'source_id', 'offer_id', 'payment_id', 'trucker_id', 'provider_transfer_id', 'destination_snapshot', 'attempts_count', 'next_retry_at', 'processing_started_at', 'manual_review_at'],
  },
  {
    gate: 'db:private-fleet-core',
    table: 'business_fleet_members',
    columns: ['id', 'business_id', 'trucker_id', 'status', 'internal_driver_id', 'vehicle_plate'],
  },
  {
    gate: 'db:private-fleet-finance',
    table: 'trip_financial_allocations',
    columns: ['id', 'offer_id', 'business_id', 'trucker_id', 'allocation_type', 'amount', 'status'],
  },
  {
    gate: 'db:wallet2-private-fleet-allocations',
    table: 'trip_financial_allocations',
    columns: ['id', 'external_payment_status', 'external_paid_at', 'external_paid_by', 'external_payment_method', 'external_payment_reference', 'external_payment_proof_url', 'external_payment_proof_storage_path', 'external_payment_note'],
  },
  {
    gate: 'db:wallet2-private-fleet-payroll-runs',
    table: 'private_fleet_payroll_runs',
    columns: ['id', 'payment_mode', 'external_payment_status', 'external_paid_at', 'external_paid_by', 'external_payment_method', 'external_payment_reference', 'external_payment_proof_url', 'external_payment_proof_storage_path', 'external_payment_note'],
  },
  {
    gate: 'db:wallet2-private-fleet-payment-proofs',
    table: 'private_fleet_payment_proofs',
    columns: ['id', 'business_id', 'run_id', 'allocation_id', 'offer_id', 'uploaded_by', 'payment_method', 'amount_cop', 'status', 'created_at'],
  },
  {
    gate: 'db:cargo-offer-control-tower-columns',
    table: 'cargo_offers',
    columns: ['id', 'manifest_items', 'manifest_loaded_count', 'manifest_delivered_count', 'manifest_rejected_count', 'is_private_fleet', 'private_fleet_trucker_id', 'expense_allowance_amount', 'freight_payment_amount', 'compensation_mode', 'dispatch_trip_mode', 'source_dispatch_id', 'private_payment_status'],
  },
  {
    gate: 'db:wms-dispatch-control-tower-columns',
    table: 'warehouse_dispatch_orders',
    columns: ['id', 'offer_id', 'status', 'dispatch_trip_mode', 'trip_creation_status', 'trip_creation_error', 'trip_created_at', 'metadata'],
  },
  {
    gate: 'db:trucker-score',
    table: 'trucker_scores',
    columns: ['trucker_id', 'score', 'tier', 'completed_trips', 'calculated_at'],
  },
  {
    gate: 'db:notification-sequences',
    table: 'notification_sequences',
    columns: ['id', 'key', 'audience', 'trigger_event', 'title_template'],
  },
  {
    gate: 'db:notification-deliveries',
    table: 'notification_deliveries',
    columns: ['id', 'user_id', 'sequence_key', 'status', 'created_at'],
  },
  {
    gate: 'db:business-monthly-reports',
    table: 'report_exports',
    columns: ['id', 'business_id', 'report_type', 'period_start', 'summary'],
  },
  {
    gate: 'db:pilot-limits',
    table: 'business_pilot_flags',
    columns: ['business_id', 'enabled', 'pilot_expires_at', 'max_warehouses'],
  },
  {
    gate: 'db:paywall-events',
    table: 'paywall_events',
    columns: ['id', 'business_id', 'feature_key', 'current_usage', 'limit_value', 'recommended_plan'],
  },
  {
    gate: 'db:trip-tracking-sessions',
    table: 'trip_tracking_sessions',
    columns: ['id', 'offer_id', 'trucker_id', 'status', 'last_ping_at', 'last_latitude', 'last_longitude'],
  },
  {
    gate: 'db:trip-location-pings',
    table: 'trip_location_pings',
    columns: ['id', 'session_id', 'offer_id', 'trucker_id', 'latitude', 'longitude', 'captured_at'],
  },
  {
    gate: 'db:release-gate-checks',
    table: 'release_gate_checks',
    columns: ['id', 'gate_key', 'status', 'environment', 'evidence'],
  },
  {
    gate: 'db:internal-admin-memberships',
    table: 'internal_admin_memberships',
    columns: ['id', 'user_id', 'role', 'status', 'created_by', 'updated_by'],
  },
  {
    gate: 'db:staff-memberships',
    table: 'staff_memberships',
    columns: ['id', 'user_id', 'role', 'status', 'created_by', 'updated_by'],
  },
  {
    gate: 'db:staff-audit-events',
    table: 'staff_audit_events',
    columns: ['id', 'actor_id', 'actor_role', 'capability', 'target_type', 'target_id', 'previous_state', 'new_state'],
  },
  {
    gate: 'db:support-ticket-messages',
    table: 'support_ticket_messages',
    columns: ['id', 'ticket_id', 'author_id', 'author_role', 'visibility', 'body'],
  },
  {
    gate: 'db:support-ticket-events',
    table: 'support_ticket_events',
    columns: ['id', 'ticket_id', 'actor_id', 'actor_role', 'action', 'metadata'],
  },
  {
    gate: 'db:support-requests-portal-columns',
    table: 'support_requests',
    columns: ['id', 'category', 'assigned_to', 'related_user_id', 'related_offer_id', 'last_message_at'],
  },
];
const requiredFeatureFlags = [
  ['lending_enabled', false],
  ['pilot_generous_limits', true],
  ['automatic_payouts_enabled', false],
  ['express_payment_enabled', false],
  ['live_trip_tracking_enabled', true],
  ['advanced_business_roles_enabled', true],
  ['wms_dispatch_trip_enabled', true],
  ['ceo_control_tower_enabled', true],
  ['release_gate_required', true],
];
const requiredStorageBuckets = [
  'offer-photos',
  'trip-photos',
  'trip-signatures',
  'warehouse-sku-images',
  'private-fleet-payment-proofs',
];
const defaultCanonicalProductionAppUrl = 'https://www.kargax.online';
const stagingAppHosts = new Set([
  'kargax-staging.vercel.app',
]);
const productionAppHosts = new Set([
  'www.kargax.online',
  'kargax.online',
  'app.kargax.online',
]);
const loadedEnvFiles = [];

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  let value = normalized.slice(separatorIndex + 1).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const file = readFileSync(path, 'utf8');

  for (const line of file.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (!parsed || Object.prototype.hasOwnProperty.call(process.env, parsed.key)) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }

  loadedEnvFiles.push(path.replace(repoRoot, '.'));
}

function loadLocalEnv() {
  const targetEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || 'production';
  const productionCheckEnv = resolve(root, '.env.production.check');
  const vercelProductionEnv = resolve(root, '.vercel/.env.production.local');
  const vercelPreviewEnv = resolve(root, '.vercel/.env.preview.local');
  const candidates = [
    ...(targetEnv === 'production' ? [
      productionCheckEnv,
      vercelProductionEnv,
    ] : []),
    resolve(repoRoot, '.env'),
    resolve(repoRoot, '.env.local'),
    resolve(root, '.env'),
    resolve(root, '.env.local'),
    resolve(root, `.env.${targetEnv}`),
    resolve(root, `.env.${targetEnv}.local`),
    ...(targetEnv === 'production' ? [
      vercelPreviewEnv,
    ] : [
      productionCheckEnv,
      vercelPreviewEnv,
      vercelProductionEnv,
    ]),
  ];

  for (const candidate of candidates) {
    loadEnvFile(candidate);
  }
}

function fail(message, evidence = {}) {
  return { gate: message, status: 'fail', evidence };
}

function pass(message, evidence = {}) {
  return { gate: message, status: 'pass', evidence };
}

function run(command, args) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const finalArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', command, ...args]
    : args;
  const result = spawnSync(executable, finalArgs, {
    cwd: root,
    stdio: 'pipe',
    shell: false,
    encoding: 'utf8',
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout?.slice(-2000) || '',
    stderr: result.stderr?.slice(-2000) || '',
    error: result.error?.message,
  };
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function isTransientFetchError(error) {
  const message = error?.message || String(error || '');
  return /fetch failed|network|timeout|ECONNRESET|ETIMEDOUT/i.test(message);
}

function sanitizeSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      origin: parsed.origin,
      host: parsed.host,
      project_ref: parsed.host.split('.')[0] || null,
    };
  } catch {
    return { origin: null, host: null, project_ref: null };
  }
}

function normalizeUrlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeUrlHostname(value) {
  try {
    const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(value)
      ? value
      : `https://${value}`;
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isStagingAppUrl(value) {
  const hostname = normalizeUrlHostname(value || '');
  return hostname ? stagingAppHosts.has(hostname) : false;
}

function isProductionAppUrl(value) {
  const hostname = normalizeUrlHostname(value || '');
  return hostname ? productionAppHosts.has(hostname) : false;
}

function validateProductionAppUrl(appUrl, strictProduction) {
  const canonicalProductionAppUrl = process.env.KARGAX_CANONICAL_APP_URL || defaultCanonicalProductionAppUrl;
  const appOrigin = normalizeUrlOrigin(appUrl);
  const canonicalOrigin = normalizeUrlOrigin(canonicalProductionAppUrl);

  if (!strictProduction) {
    return pass('public-url-production', {
      appUrl: appOrigin || appUrl || null,
      strictProduction,
      canonicalAppUrl: canonicalOrigin,
    });
  }

  if (!appOrigin) {
    return fail('public-url-production', {
      appUrl: appUrl || null,
      strictProduction,
      canonicalAppUrl: canonicalOrigin,
      reason: 'NEXT_PUBLIC_APP_URL is not a valid URL',
    });
  }

  if (!appOrigin.startsWith('https://') || /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(appOrigin)) {
    return fail('public-url-production', {
      appUrl: appOrigin,
      strictProduction,
      canonicalAppUrl: canonicalOrigin,
      reason: 'Production URL must use a public HTTPS domain',
    });
  }

  if (isStagingAppUrl(appOrigin)) {
    return pass('public-url-production', {
      appUrl: appOrigin,
      strictProduction,
      canonicalAppUrl: canonicalOrigin,
      stagingRuntime: true,
    });
  }

  if (appOrigin !== canonicalOrigin) {
    return fail('public-url-production', {
      appUrl: appOrigin,
      strictProduction,
      canonicalAppUrl: canonicalOrigin,
      reason: 'Production canonical domain mismatch',
    });
  }

  return pass('public-url-production', {
    appUrl: appOrigin,
    strictProduction,
    canonicalAppUrl: canonicalOrigin,
  });
}

function validateNotificationRuntime(appUrl, strictProduction) {
  const configuredProvider = (process.env.NOTIFICATION_PROVIDER || 'console').trim().toLowerCase();
  const stagingRuntime = process.env.VERCEL_ENV === 'preview' || isStagingAppUrl(appUrl);
  const productionHost = isProductionAppUrl(appUrl);
  const hasTwilioEnv = Boolean(
    process.env.TWILIO_ACCOUNT_SID
    || process.env.TWILIO_AUTH_TOKEN
    || process.env.TWILIO_PHONE_NUMBER
    || process.env.TWILIO_MESSAGING_SERVICE_SID
  );
  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );

  if (stagingRuntime) {
    if (configuredProvider === 'twilio' || hasTwilioEnv) {
      return fail('notifications-runtime', {
        appUrl: normalizeUrlOrigin(appUrl) || appUrl || null,
        configuredProvider,
        effectiveProvider: 'console',
        stagingRuntime,
        reason: 'Staging must not be configured with Twilio credentials or provider.',
      });
    }

    return pass('notifications-runtime', {
      appUrl: normalizeUrlOrigin(appUrl) || appUrl || null,
      configuredProvider,
      effectiveProvider: 'console',
      stagingRuntime,
      realSmsEnabled: false,
    });
  }

  if (strictProduction || productionHost) {
    if (configuredProvider !== 'twilio') {
      return fail('notifications-runtime', {
        appUrl: normalizeUrlOrigin(appUrl) || appUrl || null,
        configuredProvider,
        productionHost,
        strictProduction,
        reason: 'Production must use NOTIFICATION_PROVIDER=twilio.',
      });
    }

    if (!twilioConfigured) {
      return fail('notifications-runtime', {
        appUrl: normalizeUrlOrigin(appUrl) || appUrl || null,
        configuredProvider,
        productionHost,
        strictProduction,
        reason: 'Production Twilio credentials or sender are incomplete.',
      });
    }
  }

  return pass('notifications-runtime', {
    appUrl: normalizeUrlOrigin(appUrl) || appUrl || null,
    configuredProvider,
    effectiveProvider: configuredProvider,
    stagingRuntime,
    productionHost,
    realSmsEnabled: configuredProvider === 'twilio',
  });
}

function validateProductionObservability(strictProduction) {
  const sentryConfigured = Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
    || process.env.SENTRY_DSN?.trim()
  );
  const posthogConfigured = Boolean(
    (process.env.POSTHOG_CAPTURE_URL?.trim() || process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim())
    && (
      process.env.POSTHOG_API_KEY?.trim()
      || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
      || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()
    )
  );

  if (strictProduction && !sentryConfigured) {
    return fail('observability-production', {
      sentryConfigured,
      posthogConfigured,
      reason: 'Production requires error monitoring before public go-live',
    });
  }

  return pass('observability-production', {
    sentryConfigured,
    posthogConfigured,
    strictProduction,
  });
}

async function probeDbShape(supabase, shape) {
  let error = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await supabase
      .from(shape.table)
      .select(shape.columns.join(','))
      .limit(1);

    error = result.error;

    if (!error || !isTransientFetchError(error)) {
      break;
    }

    await sleep(250 * attempt);
  }

  return error
    ? fail(shape.gate, {
        table: shape.table,
        columns: shape.columns,
        code: error.code || null,
        message: error.message || 'Unknown Supabase schema error',
      })
    : pass(shape.gate, { table: shape.table, columns: shape.columns.length });
}

async function runRemoteSupabaseChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return [fail('db:remote-schema', { missing_env: true })];
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const remoteChecks = [
    pass('supabase-target', sanitizeSupabaseUrl(url)),
  ];

  for (const shape of requiredDbShapes) {
    remoteChecks.push(await probeDbShape(supabase, shape));
  }

  const { data: flags, error: flagsError } = await supabase
    .from('feature_flags')
    .select('key,enabled')
    .in('key', requiredFeatureFlags.map(([key]) => key));

  if (flagsError) {
    remoteChecks.push(fail('db:required-feature-flags', {
      code: flagsError.code || null,
      message: flagsError.message || 'Could not read feature flags',
    }));
  } else {
    const flagMap = new Map((flags || []).map((flag) => [flag.key, flag.enabled]));
    const mismatches = requiredFeatureFlags
      .map(([key, expected]) => ({ key, expected, actual: flagMap.has(key) ? flagMap.get(key) : null }))
      .filter((flag) => flag.actual !== flag.expected);

    remoteChecks.push(mismatches.length
      ? fail('db:required-feature-flags', { mismatches })
      : pass('db:required-feature-flags', { count: requiredFeatureFlags.length }));
  }

  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    remoteChecks.push(fail('storage:required-buckets', {
      message: bucketsError.message || 'Could not list storage buckets',
    }));
  } else {
    const bucketIds = new Set((buckets || []).map((bucket) => bucket.id));
    const missingBuckets = requiredStorageBuckets.filter((bucketId) => !bucketIds.has(bucketId));

    remoteChecks.push(missingBuckets.length
      ? fail('storage:required-buckets', { missing: missingBuckets })
      : pass('storage:required-buckets', { count: requiredStorageBuckets.length }));
  }

  return remoteChecks;
}

const checks = [];

loadLocalEnv();

const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
const strictProduction = process.env.VERCEL_ENV === 'production' || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');

checks.push(...requiredEnv.map((name) => (
  process.env[name] ? pass(`env:${name}`) : fail(`env:${name}`, { missing: true })
)));
checks.push(validateProductionAppUrl(appUrl, strictProduction));
checks.push(validateProductionObservability(strictProduction));
checks.push(validateNotificationRuntime(appUrl, strictProduction));
checks.push(existsSync(resolve(root, 'src/proxy.ts'))
  ? pass('rate-limit-proxy-present')
  : fail('rate-limit-proxy-present'));
checks.push(existsSync(resolve(root, 'src/app/api/health/route.ts'))
  ? pass('health-route-present')
  : fail('health-route-present'));
checks.push(existsSync(resolve(repoRoot, 'supabase/migrations/005_offer_photos.sql'))
  ? pass('offer-photos-migration-present')
  : fail('offer-photos-migration-present'));
checks.push(existsSync(resolve(repoRoot, 'supabase/migrations/044_retention_infra_pricing.sql'))
  ? pass('pilot-retention-pricing-migration-present')
  : fail('pilot-retention-pricing-migration-present'));
checks.push(existsSync(resolve(repoRoot, 'supabase/migrations/045_trabajoia_tracking_and_settlement.sql'))
  ? pass('trabajoia-tracking-settlement-migration-present')
  : fail('trabajoia-tracking-settlement-migration-present'));
checks.push(existsSync(resolve(repoRoot, 'supabase/migrations/046_business_role_presets.sql'))
  ? pass('business-role-presets-migration-present')
  : fail('business-role-presets-migration-present'));

checks.push(...await runRemoteSupabaseChecks());

const typecheck = run('npm', ['--prefix', root, 'run', 'typecheck']);
checks.push(typecheck.ok
  ? pass('typecheck', { status: typecheck.status })
  : fail('typecheck', typecheck));

const visualQa = run('node', ['./scripts/visual-qa-release-gate.mjs', '--static']);
checks.push(visualQa.ok
  ? pass('visual-qa-release-gate', { status: visualQa.status, mode: 'static' })
  : fail('visual-qa-release-gate', visualQa));

const failures = checks.filter((check) => check.status === 'fail');
const payload = {
  generated_at: new Date().toISOString(),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
  status: failures.length ? 'fail' : 'pass',
  loaded_env_files: loadedEnvFiles,
  checks,
};

console.log(JSON.stringify(payload, null, 2));

if (failures.length) {
  process.exit(1);
}
