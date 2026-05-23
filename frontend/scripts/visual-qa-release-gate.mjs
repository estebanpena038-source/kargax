#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const cwd = resolve(process.cwd());
const root = existsSync(resolve(cwd, 'src/app')) ? cwd : resolve(cwd, 'frontend');
const repoRoot = basename(root) === 'frontend' ? resolve(root, '..') : root;
const srcRoot = resolve(root, 'src');
const appRoot = resolve(srcRoot, 'app');
const componentsRoot = resolve(srcRoot, 'components');
const qaRoot = resolve(repoRoot, 'qa', 'visual-release-gate');
const args = process.argv.slice(2);
const staticOnly = args.includes('--static') || args.includes('--no-browser');
const requireBrowser = args.includes('--require-browser');
const jsonOnly = args.includes('--json');

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] || null;
}

const baseUrl =
  readArg('--base-url') ||
  process.env.VISUAL_QA_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  '';

const requiredRoutes = [
  '/',
  '/para-camioneros',
  '/soporte',
  '/terminos',
  '/privacidad',
  '/ayuda',
  '/login',
  '/registro',
  '/recuperar-contrasena',
  '/verificar-email',
  '/auth/reset-password',
  '/auth/mfa/setup',
  '/auth/mfa/verify',
  '/auth/invite/accept',
  '/dashboard',
  '/perfil',
  '/configuracion',
  '/notificaciones',
  '/mensajes',
  '/onboarding',
  '/ofertas',
  '/ofertas/[id]',
  '/ofertas/publicar',
  '/ofertas/editar/[id]',
  '/ofertas/mis-ofertas',
  '/postulaciones',
  '/postulaciones-recibidas',
  '/ofertas-aceptadas',
  '/pagar/[offerId]',
  '/pago/exitoso',
  '/pago/fallido',
  '/pago/pendiente',
  '/billetera',
  '/viaje/[offerId]',
  '/viaje/[offerId]/carga',
  '/viaje/[offerId]/entrega',
  '/inspecciones',
  '/inspecciones/[offerId]',
  '/bodegas',
  '/bodegas/[id]',
  '/bodegas/[id]/analitica',
  '/bodegas/[id]/citas',
  '/bodegas/[id]/muelles',
  '/bodegas/[id]/inventario',
  '/bodegas/[id]/recepciones',
  '/bodegas/[id]/picking',
  '/bodegas/[id]/despachos',
  '/bodegas/[id]/incidentes',
  '/equipo',
  '/dashboard/flota',
  '/dashboard/inteligencia',
  '/corporativo',
  '/planes',
  '/admin',
  '/admin/ceo',
];

const browserRoutes = [
  '/',
  '/login',
  '/registro',
  '/dashboard',
  '/ofertas',
  '/billetera',
  '/bodegas',
  '/planes',
  '/admin/ceo',
];

const requiredNeutralFamilies = [
  'green',
  'emerald',
  'orange',
  'amber',
  'blue',
  'violet',
  'purple',
  'yellow',
  'red',
  'rose',
  'pink',
  'fuchsia',
  'indigo',
  'sky',
  'cyan',
  'teal',
  'lime',
];

const checks = [];
const warnings = [];

function routeToPagePath(route) {
  if (route === '/') {
    return resolve(appRoot, 'page.tsx');
  }

  const segments = route.split('/').filter(Boolean);
  return resolve(appRoot, ...segments, 'page.tsx');
}

function normalizeUrl(base, path) {
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}${path === '/' ? '/' : path}`;
}

function addCheck(key, status, evidence = {}, blocking = true) {
  const item = { key, status, blocking, evidence };
  checks.push(item);
  return item;
}

function addWarning(key, evidence = {}) {
  warnings.push({ key, evidence });
}

function listFiles(dir, predicate, output = []) {
  if (!existsSync(dir)) {
    return output;
  }

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry)) {
        continue;
      }
      listFiles(fullPath, predicate, output);
      continue;
    }

    if (predicate(fullPath)) {
      output.push(fullPath);
    }
  }

  return output;
}

function compactPath(path) {
  return relative(repoRoot, path).replaceAll('\\', '/');
}

function runStaticChecks() {
  const missingRoutes = requiredRoutes
    .map((route) => ({ route, path: routeToPagePath(route) }))
    .filter((item) => !existsSync(item.path))
    .map((item) => ({ route: item.route, expected: compactPath(item.path) }));

  addCheck(
    'routes:mandatory-pages',
    missingRoutes.length ? 'fail' : 'pass',
    {
      required: requiredRoutes.length,
      missing: missingRoutes,
    }
  );

  const globalsPath = resolve(appRoot, 'globals.css');
  const globals = existsSync(globalsPath) ? readFileSync(globalsPath, 'utf8') : '';
  const clampMissing = requiredNeutralFamilies.filter((family) => !globals.includes(`${family}-`));

  addCheck(
    'design:matte-monochrome-tokens',
    globals.includes('--color-primary:       #0a0a0a') &&
      globals.includes('--color-background:     #f7f7f5') &&
      globals.includes('--color-text-primary:   #0a0a0a')
      ? 'pass'
      : 'fail',
    {
      file: compactPath(globalsPath),
      expected: ['#0a0a0a primary', '#f7f7f5 background', '#0a0a0a text'],
    }
  );

  addCheck(
    'design:forbidden-color-clamp',
    globals.includes('Monochrome clamp') && clampMissing.length === 0 ? 'pass' : 'fail',
    {
      file: compactPath(globalsPath),
      neutralized_families: requiredNeutralFamilies.length - clampMissing.length,
      missing_families: clampMissing,
    }
  );

  addCheck(
    'a11y:focus-visible',
    globals.includes(':focus-visible') && /outline[^;]+var\(--color-accent\)/.test(globals) ? 'pass' : 'fail',
    { file: compactPath(globalsPath) }
  );

  addCheck(
    'layout:no-horizontal-body-overflow',
    /body\s*\{[\s\S]*overflow-x:\s*hidden/.test(globals) ? 'pass' : 'fail',
    { file: compactPath(globalsPath) }
  );

  const publicLuxuryPath = resolve(componentsRoot, 'public', 'PublicLuxury.tsx');
  const dashboardLayoutPath = resolve(componentsRoot, 'layouts', 'DashboardLayout.tsx');
  const publicLuxury = existsSync(publicLuxuryPath) ? readFileSync(publicLuxuryPath, 'utf8') : '';
  const dashboardLayout = existsSync(dashboardLayoutPath) ? readFileSync(dashboardLayoutPath, 'utf8') : '';

  addCheck(
    'brand:public-shell-logo',
    publicLuxury.includes('KargaxLogo') && publicLuxury.includes('KargaX inicio') ? 'pass' : 'fail',
    { file: compactPath(publicLuxuryPath) }
  );

  addCheck(
    'brand:private-shell-logo',
    dashboardLayout.includes('KargaxLogo') && dashboardLayout.includes('href="/dashboard"') ? 'pass' : 'fail',
    { file: compactPath(dashboardLayoutPath) }
  );

  const scannedFiles = [
    ...listFiles(appRoot, (path) => /\.(tsx|css)$/.test(path)),
    ...listFiles(componentsRoot, (path) => /\.(tsx|css)$/.test(path)),
  ];
  const forbiddenClassPattern = new RegExp(
    String.raw`\b(?:text|bg|border|from|via|to|ring|shadow|fill|stroke|accent|caret|decoration|divide)-(?:${requiredNeutralFamilies.join('|')})-`,
    'g'
  );
  const forbiddenUtilityHits = [];
  const hardColorHits = [];

  for (const file of scannedFiles) {
    const source = readFileSync(file, 'utf8');
    const classMatches = source.match(forbiddenClassPattern) || [];
    if (classMatches.length) {
      forbiddenUtilityHits.push({
        file: compactPath(file),
        count: classMatches.length,
        samples: [...new Set(classMatches)].slice(0, 8),
      });
    }

    const hexMatches = source.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    const nonNeutralHex = hexMatches.filter((hex) => !isNeutralHex(hex));
    if (nonNeutralHex.length) {
      hardColorHits.push({
        file: compactPath(file),
        count: nonNeutralHex.length,
        samples: [...new Set(nonNeutralHex)].slice(0, 8),
      });
    }
  }

  addWarning('source:legacy-color-utilities-neutralized-by-css', {
    files: forbiddenUtilityHits.length,
    hits: forbiddenUtilityHits.reduce((sum, item) => sum + item.count, 0),
    samples: forbiddenUtilityHits.slice(0, 20),
  });

  addWarning('source:hard-coded-non-neutral-colors-to-review', {
    files: hardColorHits.length,
    hits: hardColorHits.reduce((sum, item) => sum + item.count, 0),
    samples: hardColorHits.slice(0, 20),
  });
}

function isNeutralHex(hex) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized.slice(0, 6);

  if (expanded.length !== 6) {
    return true;
  }

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) <= 14;
}

async function launchBrowser(chromium) {
  const launchOptions = [
    { headless: true },
    { headless: true, channel: 'msedge' },
    { headless: true, channel: 'chrome' },
  ];
  let lastError = null;

  for (const options of launchOptions) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function slugRoute(route) {
  if (route === '/') {
    return 'home';
  }

  return route
    .replace(/^\//, '')
    .replaceAll('/', '-')
    .replaceAll('[', '')
    .replaceAll(']', '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase();
}

function createRunDir() {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = resolve(qaRoot, runId);
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

async function runBrowserChecks() {
  if (!baseUrl) {
    const status = requireBrowser ? 'fail' : 'skipped';
    addCheck('browser:base-url', status, {
      required_env: 'VISUAL_QA_BASE_URL',
      message: 'Set VISUAL_QA_BASE_URL=http://localhost:3000 to capture screenshots.',
    }, requireBrowser);
    return { status, results: [], output_dir: null };
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (error) {
    addCheck('browser:playwright-installed', 'fail', {
      message: error instanceof Error ? error.message : 'Playwright import failed',
    });
    return { status: 'fail', results: [], output_dir: null };
  }

  const outputDir = createRunDir();
  const browser = await launchBrowser(playwright.chromium);
  const results = [];
  const viewports = [
    { key: 'mobile-360', width: 360, height: 800 },
    { key: 'mobile-390', width: 390, height: 844 },
    { key: 'mobile-414', width: 414, height: 896 },
    { key: 'tablet-768', width: 768, height: 1024 },
    { key: 'tablet-820', width: 820, height: 1180 },
    { key: 'tablet-landscape-1024', width: 1024, height: 768 },
    { key: 'laptop-1366', width: 1366, height: 900 },
    { key: 'desktop-1440', width: 1440, height: 1000 },
    { key: 'desktop-1920', width: 1920, height: 1080 },
  ];

  try {
    for (const route of browserRoutes) {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const routeResult = {
          route,
          viewport: viewport.key,
          status: 'pass',
          final_url: null,
          screenshot: null,
          failures: [],
          evidence: {},
        };

        try {
          const response = await page.goto(normalizeUrl(baseUrl, route), {
            waitUntil: 'networkidle',
            timeout: 45000,
          });
          await page.waitForTimeout(600);

          const screenshotName = `${viewport.key}-${slugRoute(route)}.png`;
          const screenshotPath = resolve(outputDir, screenshotName);
          await page.screenshot({ path: screenshotPath, fullPage: true });

          const evidence = await page.evaluate(() => {
            function isVisible(element) {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                Number(style.opacity || '1') > 0.03 &&
                rect.width > 0 &&
                rect.height > 0
              );
            }

            function parseRgb(value) {
              const matches = [...value.matchAll(/rgba?\(([^)]+)\)/g)];
              return matches.map((match) => {
                const parts = match[1].split(',').map((part) => part.trim());
                return {
                  r: Number.parseFloat(parts[0] || '0'),
                  g: Number.parseFloat(parts[1] || '0'),
                  b: Number.parseFloat(parts[2] || '0'),
                  a: parts[3] === undefined ? 1 : Number.parseFloat(parts[3]),
                  raw: match[0],
                };
              });
            }

            function isNeutralColor(color) {
              if (!Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) {
                return true;
              }

              if (color.a < 0.1) {
                return true;
              }

              const max = Math.max(color.r, color.g, color.b);
              const min = Math.min(color.r, color.g, color.b);
              return max - min <= 18;
            }

            function describeElement(element) {
              const id = element.id ? `#${element.id}` : '';
              const classes = typeof element.className === 'string'
                ? `.${element.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')}`
                : '';
              const text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
              return `${element.tagName.toLowerCase()}${id}${classes}${text ? ` "${text}"` : ''}`;
            }

            const visibleElements = [...document.querySelectorAll('body *')].filter(isVisible);
            const coloredElements = [];
            for (const element of visibleElements) {
              const style = window.getComputedStyle(element);
              const colors = [
                ...parseRgb(style.color),
                ...parseRgb(style.backgroundColor),
                ...parseRgb(style.borderTopColor),
                ...parseRgb(style.borderRightColor),
                ...parseRgb(style.borderBottomColor),
                ...parseRgb(style.borderLeftColor),
                ...parseRgb(style.outlineColor),
                ...parseRgb(style.boxShadow),
              ];
              const nonNeutral = colors.filter((color) => !isNeutralColor(color));
              if (nonNeutral.length) {
                coloredElements.push({
                  element: describeElement(element),
                  colors: nonNeutral.map((color) => color.raw).slice(0, 4),
                });
              }
              if (coloredElements.length >= 20) {
                break;
              }
            }

            const interactiveElements = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
              .filter(isVisible);
            const clippedInteractive = interactiveElements
              .filter((element) => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2)
              .slice(0, 12)
              .map(describeElement);
            const tinyInteractive = interactiveElements
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width < 32 || rect.height < 32;
              })
              .slice(0, 12)
              .map(describeElement);
            const unlabeledFields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')]
              .filter(isVisible)
              .filter((element) => {
                const id = element.getAttribute('id');
                const hasExplicitLabel = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
                return !hasExplicitLabel &&
                  !element.getAttribute('aria-label') &&
                  !element.getAttribute('aria-labelledby');
              })
              .slice(0, 12)
              .map(describeElement);

            const bodyText = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
            const logoVisible = /KargaX|KX/.test(bodyText) ||
              Boolean(document.querySelector('[aria-label*="KargaX"], img[src*="kargax"], svg[aria-label*="KargaX"]'));
            const html = document.documentElement;

            return {
              title: document.title,
              body_text_length: bodyText.length,
              body_text_sample: bodyText.slice(0, 160),
              logo_visible: logoVisible,
              horizontal_overflow_px: Math.max(0, html.scrollWidth - html.clientWidth),
              colored_elements: coloredElements,
              clipped_interactive: clippedInteractive,
              tiny_interactive: tinyInteractive,
              unlabeled_fields: unlabeledFields,
            };
          });

          routeResult.final_url = page.url();
          routeResult.screenshot = compactPath(screenshotPath);
          routeResult.evidence = {
            http_status: response?.status() || null,
            ...evidence,
          };

          if (!response || response.status() >= 500) {
            routeResult.failures.push(`http:${response?.status() || 'no-response'}`);
          }

          if (evidence.body_text_length < 24) {
            routeResult.failures.push('blank-or-nearly-blank');
          }

          if (evidence.horizontal_overflow_px > 2) {
            routeResult.failures.push(`horizontal-overflow:${evidence.horizontal_overflow_px}px`);
          }

          if (!evidence.logo_visible) {
            routeResult.failures.push('logo-not-visible');
          }

          if (evidence.colored_elements.length) {
            routeResult.failures.push('non-neutral-visible-color');
          }

          if (evidence.clipped_interactive.length) {
            routeResult.failures.push('clipped-interactive-text');
          }

          if (viewport.width < 768 && evidence.tiny_interactive.length) {
            routeResult.failures.push('mobile-touch-target-too-small');
          }

          if (evidence.unlabeled_fields.length) {
            routeResult.failures.push('unlabeled-form-field');
          }

          routeResult.status = routeResult.failures.length ? 'fail' : 'pass';
        } catch (error) {
          routeResult.status = 'fail';
          routeResult.failures.push('browser-exception');
          routeResult.evidence.error = error instanceof Error ? error.message : 'Unknown browser error';
        } finally {
          await context.close();
        }

        results.push(routeResult);
      }
    }
  } finally {
    await browser.close();
  }

  const failingRoutes = results.filter((result) => result.status === 'fail');
  addCheck('browser:visual-screenshots', failingRoutes.length ? 'fail' : 'pass', {
    base_url: baseUrl,
    output_dir: compactPath(outputDir),
    routes: browserRoutes.length,
    screenshots: results.length,
    failures: failingRoutes.map((item) => ({
      route: item.route,
      viewport: item.viewport,
      failures: item.failures,
      screenshot: item.screenshot,
    })),
  });

  return {
    status: failingRoutes.length ? 'fail' : 'pass',
    results,
    output_dir: outputDir,
  };
}

runStaticChecks();

const browser = staticOnly
  ? { status: 'skipped', results: [], output_dir: null }
  : await runBrowserChecks();

const failures = checks.filter((check) => check.blocking && check.status === 'fail');
const payload = {
  generated_at: new Date().toISOString(),
  status: failures.length ? 'fail' : 'pass',
  mode: {
    static_only: staticOnly,
    browser_required: requireBrowser,
    browser_status: browser.status,
  },
  routes: {
    required: requiredRoutes,
    browser: browserRoutes,
  },
  checks,
  warnings,
  browser_results: browser.results,
};

mkdirSync(qaRoot, { recursive: true });
writeFileSync(resolve(qaRoot, 'latest.json'), `${JSON.stringify(payload, null, 2)}\n`);

if (!jsonOnly) {
  const fileUrl = pathToFileURL(resolve(qaRoot, 'latest.json')).href;
  console.log(JSON.stringify({
    status: payload.status,
    checks: checks.length,
    warnings: warnings.length,
    browser_status: browser.status,
    report: fileUrl,
  }, null, 2));
} else {
  console.log(JSON.stringify(payload, null, 2));
}

if (failures.length) {
  process.exit(1);
}
