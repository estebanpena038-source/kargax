#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as wait } from 'node:timers/promises';

const ROOT = resolve(process.cwd());
const DEFAULT_DATA_PATH = resolve(ROOT, 'CLIENTES5.0(2)', 'CLIENTES5.0', 'CLIENTES5.0_LEADS.json');
const DEFAULT_QUEUE_PATH = resolve(ROOT, 'CLIENTES5.0(2)', 'CLIENTES5.0', 'CLIENTES5.0_OUTREACH_QUEUE.csv');
const DEFAULT_LOG_PATH = resolve(ROOT, 'CLIENTES5.0(2)', 'CLIENTES5.0', 'CLIENTES5.0_OUTREACH_LOG.jsonl');

const FIELD_ALIASES = {
  ranking: ['Ranking', 'ranking'],
  empresa: ['Empresa', 'empresa'],
  score: ['Puntaje total 1-100', 'Puntaje total', 'Score', 'score'],
  email: ['Email publico', 'Email público', 'Email pÃºblico'],
  phone: ['Telefono publico', 'Teléfono público', 'TelÃ©fono pÃºblico'],
  bestChannel: ['Mejor canal', 'Mejor canal'],
  recommendation: ['Recomendacion final', 'Recomendación final', 'RecomendaciÃ³n final'],
  persona: ['Persona ideal a contactar'],
  pain: ['Dolor principal a mencionar'],
  angle: ['Angulo de venta personalizado', 'Ángulo de venta personalizado', 'Ãngulo de venta personalizado'],
  whatsappMessage: ['Mensaje WhatsApp'],
  emailMessage: ['Mensaje largo email'],
};

const HELP = `
Uso:
  node ./scripts/clientes5-outreach.mjs --channel whatsapp-web --limit 10
  node ./scripts/clientes5-outreach.mjs --channel email --limit 3 --send
  node ./scripts/clientes5-outreach.mjs --channel whatsapp-cloud --limit 3 --send

Canales:
  whatsapp-web     Genera links para abrir en WhatsApp Web. No envia automaticamente.
  whatsapp-cloud   Envia por WhatsApp Cloud API usando token y phone_number_id.
  email            Envia por Resend API usando RESEND_API_KEY.
  both             Email + WhatsApp Cloud API.

Variables de entorno:
  RESEND_API_KEY
  EMAIL_FROM
  EMAIL_REPLY_TO opcional

  WHATSAPP_TOKEN
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_API_VERSION opcional, default v20.0
  WHATSAPP_MODE opcional: template | text. Default template.
  WHATSAPP_TEMPLATE_NAME requerido si WHATSAPP_MODE=template
  WHATSAPP_TEMPLATE_LANG opcional, default es_CO
  WHATSAPP_TEMPLATE_VARS opcional, default empresa,dolor,persona

Opciones:
  --data <ruta>                 JSON de leads. Default CLIENTES5.0_LEADS.json.
  --channel <canal>             whatsapp-web | whatsapp-cloud | email | both.
  --send                        Ejecuta envio real. Sin esto solo hace preview/cola.
  --limit <n>                   Maximo de leads a procesar. Default 10 preview, 5 envio.
  --min-score <n>               Puntaje minimo.
  --rank <1,2,3>                Solo rankings especificos.
  --only-contactar-ya           Solo leads con recomendacion "Contactar ya".
  --force                       No saltar contactos ya enviados en el log.
  --delay-ms <n>                Pausa entre envios. Default 1200.
  --queue <ruta>                CSV de cola/preview.
  --log <ruta>                  JSONL de resultados.
  --no-opt-out                  No agregar frase de no-contacto.
  --whatsapp-mode <mode>        template | text.
  --whatsapp-template <name>    Nombre de plantilla aprobada.
  --whatsapp-template-vars <x>  Variables separadas por coma para la plantilla.
`;

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(HELP.trim());
  process.exit(0);
}

const channel = String(args.channel || 'whatsapp-web').toLowerCase();
const validChannels = new Set(['whatsapp-web', 'whatsapp-cloud', 'email', 'both']);

if (!validChannels.has(channel)) {
  fail(`Canal no soportado: ${channel}`);
}

const shouldSend = Boolean(args.send);
const limit = numberArg(args.limit, shouldSend ? 5 : 10);
const minScore = numberArg(args['min-score'], null);
const delayMs = numberArg(args['delay-ms'], 1200);
const dataPath = resolvePath(args.data || DEFAULT_DATA_PATH);
const queuePath = resolvePath(args.queue || DEFAULT_QUEUE_PATH);
const logPath = resolvePath(args.log || DEFAULT_LOG_PATH);
const selectedRanks = csvList(args.rank).map(Number).filter(Number.isFinite);
const onlyContactarYa = Boolean(args['only-contactar-ya']);
const appendOptOut = !args['no-opt-out'];
const force = Boolean(args.force);

if (!existsSync(dataPath)) {
  fail(`No existe el archivo de leads: ${dataPath}`);
}

const rawLeads = readJson(dataPath);

if (!Array.isArray(rawLeads)) {
  fail('El archivo de leads debe ser un JSON array.');
}

const sentKeys = force ? new Set() : readSentKeys(logPath);
const leads = rawLeads
  .map(normalizeLead)
  .filter((lead) => lead.empresa)
  .filter((lead) => selectedRanks.length === 0 || selectedRanks.includes(lead.ranking))
  .filter((lead) => minScore === null || lead.score >= minScore)
  .filter((lead) => !onlyContactarYa || normalizeText(lead.recommendation).includes('contactar ya'))
  .sort((a, b) => (a.ranking || 9999) - (b.ranking || 9999));

const targets = buildTargets(leads, channel, appendOptOut)
  .slice(0, Math.max(0, limit))
  .map((target) => ({
    ...target,
    skippedByLog: sentKeys.has(target.key),
  }));

const pendingTargets = targets.filter((target) => !target.skippedByLog);

writeQueue(queuePath, targets);

printSummary({
  channel,
  shouldSend,
  dataPath,
  queuePath,
  logPath,
  leadsCount: leads.length,
  targets,
  pendingTargets,
});

if (!shouldSend || channel === 'whatsapp-web') {
  if (shouldSend && channel === 'whatsapp-web') {
    console.warn('whatsapp-web no envia automaticamente. Abre los links del CSV generado.');
  }
  process.exit(0);
}

if (pendingTargets.length === 0) {
  console.log('No hay contactos pendientes para enviar.');
  process.exit(0);
}

const results = [];

for (const target of pendingTargets) {
  try {
    const result = await sendTarget(target, args);
    const entry = logEntry(target, 'sent', result);
    appendJsonLine(logPath, entry);
    results.push(entry);
    console.log(`OK ${target.channel} ${target.contact} ${target.empresa}`);
  } catch (error) {
    const entry = logEntry(target, 'failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    appendJsonLine(logPath, entry);
    results.push(entry);
    console.error(`ERROR ${target.channel} ${target.contact} ${target.empresa}: ${entry.result.error}`);
  }

  if (delayMs > 0) {
    await wait(delayMs);
  }
}

const failed = results.filter((item) => item.status === 'failed');

if (failed.length > 0) {
  console.error(`Termino con ${failed.length} error(es). Revisa el log: ${logPath}`);
  process.exit(1);
}

console.log(`Envio terminado. Log: ${logPath}`);

function normalizeLead(raw) {
  const empresa = clean(getField(raw, FIELD_ALIASES.empresa));
  const ranking = numberArg(getField(raw, FIELD_ALIASES.ranking), null);
  const score = numberArg(getField(raw, FIELD_ALIASES.score), 0);
  const emailMessage = clean(getField(raw, FIELD_ALIASES.emailMessage));
  const parsedEmail = parseEmailMessage(emailMessage, empresa);

  return {
    raw,
    ranking,
    empresa,
    score,
    recommendation: clean(getField(raw, FIELD_ALIASES.recommendation)),
    persona: clean(getField(raw, FIELD_ALIASES.persona)),
    pain: clean(getField(raw, FIELD_ALIASES.pain)),
    angle: clean(getField(raw, FIELD_ALIASES.angle)),
    bestChannel: clean(getField(raw, FIELD_ALIASES.bestChannel)),
    emails: extractEmails(getField(raw, FIELD_ALIASES.email)),
    phones: extractMobilePhones(getField(raw, FIELD_ALIASES.phone)),
    whatsappMessage: clean(getField(raw, FIELD_ALIASES.whatsappMessage)),
    emailSubject: parsedEmail.subject,
    emailBody: parsedEmail.body,
  };
}

function buildTargets(leads, selectedChannel, shouldAppendOptOut) {
  const targets = [];

  for (const lead of leads) {
    if (selectedChannel === 'email' || selectedChannel === 'both') {
      for (const email of lead.emails) {
        const body = shouldAppendOptOut ? withEmailOptOut(lead.emailBody) : lead.emailBody;
        targets.push(makeTarget(lead, 'email', email, lead.emailSubject, body));
      }
    }

    if (selectedChannel === 'whatsapp-web' || selectedChannel === 'whatsapp-cloud' || selectedChannel === 'both') {
      const whatsappChannel = selectedChannel === 'whatsapp-web' ? 'whatsapp-web' : 'whatsapp-cloud';

      for (const phone of lead.phones) {
        const body = shouldAppendOptOut ? withWhatsappOptOut(lead.whatsappMessage) : lead.whatsappMessage;
        targets.push(makeTarget(lead, whatsappChannel, phone, '', body));
      }
    }
  }

  const seen = new Set();

  return targets.filter((target) => {
    if (!target.contact || !target.message || seen.has(target.key)) {
      return false;
    }

    seen.add(target.key);
    return true;
  });
}

function makeTarget(lead, targetChannel, contact, subject, message) {
  const contactId = clean(contact).toLowerCase();
  const key = `${targetChannel}:${contactId}:${normalizeText(lead.empresa)}`;

  return {
    key,
    channel: targetChannel,
    ranking: lead.ranking,
    empresa: lead.empresa,
    score: lead.score,
    recommendation: lead.recommendation,
    persona: lead.persona,
    pain: lead.pain,
    contact: contactId,
    subject,
    message,
    whatsappLink: targetChannel === 'whatsapp-web'
      ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(contactId)}&text=${encodeURIComponent(message)}`
      : '',
  };
}

async function sendTarget(target, options) {
  if (target.channel === 'email') {
    return sendEmailWithResend(target);
  }

  if (target.channel === 'whatsapp-cloud') {
    return sendWhatsappCloud(target, options);
  }

  throw new Error(`No hay envio automatico para canal ${target.channel}`);
}

async function sendEmailWithResend(target) {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const from = requiredEnv('EMAIL_FROM');
  const replyTo = process.env.EMAIL_REPLY_TO;

  const payload = {
    from,
    to: [target.contact],
    subject: target.subject,
    text: target.message,
    html: textToHtml(target.message),
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readProviderResponse(response, 'Resend');
}

async function sendWhatsappCloud(target, options) {
  const token = requiredEnv('WHATSAPP_TOKEN');
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const version = process.env.WHATSAPP_API_VERSION || 'v20.0';
  const mode = String(options['whatsapp-mode'] || process.env.WHATSAPP_MODE || 'template').toLowerCase();
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const payload = mode === 'text'
    ? whatsappTextPayload(target)
    : whatsappTemplatePayload(target, options);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readProviderResponse(response, 'WhatsApp Cloud API');
}

function whatsappTextPayload(target) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: target.contact,
    type: 'text',
    text: {
      preview_url: false,
      body: target.message,
    },
  };
}

function whatsappTemplatePayload(target, options) {
  const templateName = options['whatsapp-template'] || process.env.WHATSAPP_TEMPLATE_NAME;

  if (!templateName) {
    throw new Error('Falta WHATSAPP_TEMPLATE_NAME o --whatsapp-template para enviar plantillas.');
  }

  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG || 'es_CO';
  const variableNames = csvList(options['whatsapp-template-vars'] || process.env.WHATSAPP_TEMPLATE_VARS || 'empresa,dolor,persona');
  const parameters = variableNames
    .map((name) => templateValue(target, name))
    .filter(Boolean)
    .map((text) => ({ type: 'text', text: text.slice(0, 1024) }));

  const template = {
    name: templateName,
    language: { code: languageCode },
  };

  if (parameters.length > 0) {
    template.components = [{ type: 'body', parameters }];
  }

  return {
    messaging_product: 'whatsapp',
    to: target.contact,
    type: 'template',
    template,
  };
}

function templateValue(target, name) {
  const key = normalizeText(name);
  const values = {
    empresa: target.empresa,
    dolor: target.pain,
    persona: target.persona,
    ranking: String(target.ranking || ''),
    score: String(target.score || ''),
    mensaje: target.message,
  };

  return clean(values[key] || '');
}

async function readProviderResponse(response, providerName) {
  const text = await response.text();
  let body = text;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${providerName} HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  return {
    provider: providerName,
    status: response.status,
    body,
  };
}

function writeQueue(path, rows) {
  ensureDir(path);
  const header = [
    'channel',
    'ranking',
    'empresa',
    'score',
    'recommendation',
    'contact',
    'subject',
    'message',
    'whatsapp_link',
    'skipped_by_log',
  ];
  const lines = [
    header.join(','),
    ...rows.map((row) => header.map((column) => csvEscape(row[camel(column)] ?? '')).join(',')),
  ];

  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
}

function printSummary(summary) {
  const previewRows = summary.targets.slice(0, 8).map((target) => ({
    channel: target.channel,
    ranking: target.ranking,
    empresa: target.empresa,
    contact: target.contact,
    score: target.score,
    skippedByLog: target.skippedByLog,
  }));

  console.log(JSON.stringify({
    mode: summary.shouldSend ? 'send' : 'preview',
    channel: summary.channel,
    dataPath: summary.dataPath,
    queuePath: summary.queuePath,
    logPath: summary.logPath,
    leadsAfterFilters: summary.leadsCount,
    targetsSelected: summary.targets.length,
    targetsPending: summary.pendingTargets.length,
    preview: previewRows,
  }, null, 2));
}

function logEntry(target, status, result) {
  return {
    createdAt: new Date().toISOString(),
    key: target.key,
    status,
    channel: target.channel,
    ranking: target.ranking,
    empresa: target.empresa,
    contact: target.contact,
    result,
  };
}

function readSentKeys(path) {
  if (!existsSync(path)) {
    return new Set();
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
  const sent = new Set();

  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      if (item?.status === 'sent' && item?.key) {
        sent.add(item.key);
      }
    } catch {
      // Ignore malformed historical lines and keep running.
    }
  }

  return sent;
}

function appendJsonLine(path, value) {
  ensureDir(path);
  appendFileSync(path, `${JSON.stringify(value)}\n`, 'utf8');
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const raw = token.slice(2);
    const [key, inlineValue] = raw.split('=', 2);

    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`No se pudo leer JSON ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && clean(row[name]) !== '') {
      return row[name];
    }
  }

  return '';
}

function parseEmailMessage(value, empresa) {
  const text = clean(value);
  const fallbackSubject = `${empresa || 'KargaX'} - piloto corto para cerrar entregas con evidencia`;

  if (!text) {
    return { subject: fallbackSubject, body: '' };
  }

  const lines = text.split(/\r?\n/);
  const firstLine = lines[0] || '';

  if (/^asunto\s*:/i.test(firstLine)) {
    return {
      subject: clean(firstLine.replace(/^asunto\s*:/i, '')) || fallbackSubject,
      body: clean(lines.slice(1).join('\n')),
    };
  }

  return {
    subject: fallbackSubject,
    body: text,
  };
}

function extractEmails(value) {
  const text = clean(value);

  if (!text || normalizeText(text).includes('no encontrado')) {
    return [];
  }

  return unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .map((email) => email.toLowerCase());
}

function extractMobilePhones(value) {
  const text = clean(value);

  if (!text || normalizeText(text).includes('no encontrado')) {
    return [];
  }

  const phones = [];
  const matcher = /(?:\+?57[\s().-]*)?(3\d{2})[\s().-]*(\d{3})[\s().-]*(\d{4})/g;

  for (const match of text.matchAll(matcher)) {
    phones.push(`57${match[1]}${match[2]}${match[3]}`);
  }

  return unique(phones);
}

function withEmailOptOut(message) {
  if (!message || normalizeText(message).includes('responde no')) {
    return message;
  }

  return `${message}\n\nSi no eres la persona indicada o no aplica, respondeme NO y no vuelvo a contactarte por este tema.`;
}

function withWhatsappOptOut(message) {
  if (!message || normalizeText(message).includes('responde no')) {
    return message;
  }

  return `${message}\n\nSi no aplica, responde NO y no te vuelvo a contactar por este tema.`;
}

function textToHtml(text) {
  return clean(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta variable de entorno ${name}.`);
  }

  return value;
}

function csvList(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => clean(item))
    .filter(Boolean);
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeText(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberArg(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function resolvePath(path) {
  return resolve(ROOT, String(path));
}

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function csvEscape(value) {
  const text = String(value ?? '');

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function camel(value) {
  return {
    whatsapp_link: 'whatsappLink',
    skipped_by_log: 'skippedByLog',
  }[value] || value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
