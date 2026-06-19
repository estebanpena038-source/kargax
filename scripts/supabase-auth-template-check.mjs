#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const checks = [
  ['supabase/templates/confirm-signup.html', 'email'],
  ['supabase/templates/recovery.html', 'recovery'],
  ['supabase/templates/invite.html', 'invite'],
  ['supabase/templates/magic-link.html', 'magiclink'],
];

const failures = [];

for (const [relativeFile, expectedType] of checks) {
  const filePath = path.resolve(ROOT, relativeFile);

  if (!fs.existsSync(filePath)) {
    failures.push(`${relativeFile}: missing template`);
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('.ConfirmationURL')) {
    failures.push(`${relativeFile}: must not use {{ .ConfirmationURL }}`);
  }

  if (!html.includes('{{ .RedirectTo }}')) {
    failures.push(`${relativeFile}: missing {{ .RedirectTo }}`);
  }

  if (!html.includes('{{ .TokenHash }}')) {
    failures.push(`${relativeFile}: missing {{ .TokenHash }}`);
  }

  if (!html.includes(`type=${expectedType}`)) {
    failures.push(`${relativeFile}: missing type=${expectedType}`);
  }
}

if (failures.length) {
  console.error('Supabase auth template check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checked: checks.map(([file, type]) => ({ file, type })),
}, null, 2));
