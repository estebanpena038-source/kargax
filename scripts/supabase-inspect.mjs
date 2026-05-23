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

const SENSITIVE_KEY_PATTERN =
  /(key|token|secret|password|hash|authorization|apikey|email|phone|document|account_number|signature|avatar_url|public_url|storage_path|address|nit|license|plate|bank|external_id|reference|invite_code|pin|full_name|contact_name|account_holder_name|requester_name)/i;

function parseArgs(argv) {
  const args = {
    envFile: null,
    table: null,
    limit: 0,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') {
      args.envFile = argv[++i];
    } else if (arg === '--table') {
      args.table = argv[++i];
    } else if (arg === '--limit') {
      args.limit = Number(argv[++i] || 0);
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (Number.isNaN(args.limit) || args.limit < 0) {
    throw new Error('--limit must be a positive number');
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run supabase:inspect
  npm run supabase:inspect -- --table cargo_offers --limit 3

Options:
  --env-file <path>  Load a specific env file before the defaults
  --table <name>     Inspect one table instead of all tables
  --limit <number>   Fetch sample rows for --table, with sensitive fields redacted
  --json             Print machine-readable JSON
`);
}

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) continue;

    const name = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    result[name] = value;
  }

  return result;
}

function loadEnv(envFile) {
  const files = [
    ...DEFAULT_ENV_FILES,
    ...(envFile ? [envFile] : []),
  ];

  const loaded = {};
  const usedFiles = [];

  for (const relativeFile of files) {
    const absoluteFile = path.resolve(ROOT, relativeFile);
    if (!fs.existsSync(absoluteFile)) continue;
    Object.assign(loaded, parseEnvFile(absoluteFile));
    usedFiles.push(path.relative(ROOT, absoluteFile));
  }

  return {
    env: {
      ...loaded,
      ...process.env,
    },
    usedFiles,
  };
}

function getSupabaseCredentials(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return {
    baseUrl: url.replace(/\/$/, ''),
    key,
    keyType: env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
  };
}

async function requestOpenApi(baseUrl, key) {
  const response = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: 'application/openapi+json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAPI request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function getDefinitions(openApiSpec) {
  return openApiSpec.definitions || openApiSpec.components?.schemas || {};
}

function getTables(openApiSpec) {
  const definitions = getDefinitions(openApiSpec);
  return Object.keys(definitions)
    .filter((name) => !name.includes(' '))
    .sort()
    .map((name) => ({
      name,
      columns: Object.keys(definitions[name]?.properties || {}),
    }));
}

async function countRows(baseUrl, key, table) {
  const response = await fetch(`${baseUrl}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    method: 'HEAD',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `${response.status} ${response.statusText}`,
    };
  }

  const contentRange = response.headers.get('content-range');
  const total = contentRange?.split('/')[1];
  return {
    ok: true,
    count: total && total !== '*' ? Number(total) : null,
  };
}

function redactValue(key, value) {
  if (value == null) return value;
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';
  if (typeof value === 'object') return redactRecord(value);
  return value;
}

function redactRecord(record) {
  if (Array.isArray(record)) {
    return record.map((item) => (item && typeof item === 'object' ? redactRecord(item) : item));
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, redactValue(key, value)]),
  );
}

async function fetchSampleRows(baseUrl, key, table, limit) {
  if (!limit) return [];

  const response = await fetch(
    `${baseUrl}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${limit}`,
    {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Sample request failed for ${table}: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  return rows.map((row) => redactRecord(row));
}

function printTableReport(report) {
  console.log(`Supabase project: ${report.projectHost}`);
  console.log(`Auth key: ${report.keyType}`);
  console.log(`Env files: ${report.usedFiles.join(', ')}`);
  console.log(`Tables detected: ${report.tables.length}`);
  console.log('');

  const tableWidth = Math.max('table'.length, ...report.tables.map((item) => item.name.length));
  console.log(`${'table'.padEnd(tableWidth)}  rows   columns`);
  console.log(`${'-'.repeat(tableWidth)}  -----  -------`);

  for (const table of report.tables) {
    const count = table.countError ? table.countError : table.count;
    const columns = table.columns.slice(0, 8).join(', ');
    console.log(`${table.name.padEnd(tableWidth)}  ${String(count).padStart(5)}  ${columns}`);
  }

  if (report.sampleRows?.length) {
    console.log('');
    console.log(`Sample rows from ${report.sampleTable} (${report.sampleRows.length}, redacted):`);
    console.log(JSON.stringify(report.sampleRows, null, 2));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { env, usedFiles } = loadEnv(args.envFile);
  const { baseUrl, key, keyType } = getSupabaseCredentials(env);
  const projectHost = new URL(baseUrl).host;
  const openApiSpec = await requestOpenApi(baseUrl, key);

  let tables = getTables(openApiSpec);
  if (args.table) {
    tables = tables.filter((table) => table.name === args.table);
    if (!tables.length) {
      throw new Error(`Table not found in Supabase OpenAPI schema: ${args.table}`);
    }
  }

  const inspectedTables = [];
  for (const table of tables) {
    const countResult = await countRows(baseUrl, key, table.name);
    inspectedTables.push({
      ...table,
      count: countResult.ok ? countResult.count : null,
      countError: countResult.ok ? null : countResult.error,
    });
  }

  const sampleRows = args.table
    ? await fetchSampleRows(baseUrl, key, args.table, args.limit)
    : [];

  const report = {
    projectHost,
    keyType,
    usedFiles,
    tables: inspectedTables,
    sampleTable: args.table,
    sampleRows,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printTableReport(report);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
