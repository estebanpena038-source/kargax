#!/usr/bin/env node
const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

if (!baseUrl) {
  console.log(JSON.stringify({
    status: 'skipped',
    reason: 'SMOKE_BASE_URL or NEXT_PUBLIC_APP_URL is required',
  }, null, 2));
  process.exit(0);
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
