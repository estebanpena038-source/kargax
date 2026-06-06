#!/usr/bin/env node
function getCliBaseUrl(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      return argv[index + 1];
    }

    if (arg.startsWith('--base-url=')) {
      return arg.slice('--base-url='.length);
    }
  }

  return null;
}

const cliBaseUrl = getCliBaseUrl(process.argv.slice(2));
const baseUrl = cliBaseUrl || process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

if (!baseUrl) {
  console.log(JSON.stringify({
    status: 'skipped',
    reason: 'SMOKE_BASE_URL or NEXT_PUBLIC_APP_URL is required',
  }, null, 2));
  process.exit(0);
}

try {
  const parsedBaseUrl = new URL(baseUrl);

  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) {
    throw new Error('Base URL must use http or https');
  }
} catch (error) {
  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    baseUrl,
    status: 'fail',
    error: error instanceof Error ? error.message : 'Invalid base URL',
  }, null, 2));
  process.exit(1);
}

const checks = [
  { key: 'health', url: '/api/health', expected: [200, 503] },
  { key: 'market-context', url: '/api/market/context', expected: [200] },
  { key: 'onboarding-status', url: '/api/onboarding/status', expected: [200] },
];

const results = [];

for (const check of checks) {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${check.url}`, { cache: 'no-store' });
    results.push({
      key: check.key,
      status: check.expected.includes(response.status) ? 'pass' : 'fail',
      http_status: response.status,
      latency_ms: Date.now() - started,
    });
  } catch (error) {
    results.push({
      key: check.key,
      status: 'fail',
      error: error instanceof Error ? error.message : 'unknown',
      latency_ms: Date.now() - started,
    });
  }
}

const failed = results.filter((item) => item.status === 'fail');
console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  baseUrl,
  status: failed.length ? 'fail' : 'pass',
  results,
}, null, 2));

if (failed.length) {
  process.exit(1);
}
