#!/usr/bin/env node
/**
 * Builds the offline copy of the app that the standalone Android app ships.
 *
 * The site itself is a Next.js server app. This script makes a throw-away copy
 * of the repository, keeps only the learning screens (kana, kanji, words,
 * progress, settings, legal pages), switches Next.js to a static export and
 * lays the files out so that /kana, /kanji, ... are plain files. The result
 * goes to scripts/ru/standalone/android/app/src/main/assets/www.
 *
 * Usage: node scripts/ru/standalone/build-web.mjs
 * Env:   STANDALONE_WORKDIR (default ../kana-dojo-standalone-work)
 *        SOURCE_URL (link to this source code, AGPL-3.0 section 6)
 */
import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const work =
  process.env.STANDALONE_WORKDIR ||
  join(root, '..', 'kana-dojo-standalone-work');
const assetsDir = join(here, 'android/app/src/main/assets/www');
const sourceUrl =
  process.env.SOURCE_URL || 'https://github.com/GraphonTail/kana-dojo';

const run = (command, cwd = work, env = {}) =>
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

function log(message) {
  process.stdout.write(`\n[standalone] ${message}\n`);
}

/** Replaces `search` with `replacement` in a file and fails loudly if it is missing. */
function patch(file, search, replacement) {
  const path = join(work, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(search)) {
    throw new Error(`Patch target not found in ${file}:\n${search}`);
  }
  writeFileSync(path, text.replace(search, replacement));
}

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path);
  }
}

// 1. Fresh copy of the sources (node_modules as hard links, no extra space).
log(`copying the repository to ${work}`);
mkdirSync(work, { recursive: true });
for (const name of readdirSync(work)) {
  if (name !== 'node_modules')
    rmSync(join(work, name), { recursive: true, force: true });
}
const skipped = new Set(
  ['node_modules', '.next', '.git', 'out', 'scripts/ru/standalone/android'].map(
    path => join(root, path),
  ),
);
for (const name of readdirSync(root)) {
  if (name === 'node_modules') continue;
  cpSync(join(root, name), join(work, name), {
    recursive: true,
    filter: source => !skipped.has(source),
  });
}
if (!existsSync(join(work, 'node_modules'))) {
  try {
    run(`cp -al "${root}/node_modules" "${work}/node_modules"`, root);
  } catch {
    run(`cp -a "${root}/node_modules" "${work}/node_modules"`, root);
  }
}

// 2. Only the learning screens: everything that needs a server goes.
log('removing server-only and web-only routes');
const removed = [
  'app/api',
  'app/llms.txt',
  'app/security.txt',
  'app/sentry-example-page',
  'app/[locale]/academy',
  'app/[locale]/anki-converter',
  'app/[locale]/conjugate',
  'app/[locale]/experiments',
  'app/[locale]/resources',
  'app/[locale]/translate',
  'app/[locale]/zen',
  'app/[locale]/(main)/glossary',
  'app/[locale]/(main)/hiragana-practice',
  'app/[locale]/(main)/how-to-use',
  'app/[locale]/(main)/jlpt',
  'app/[locale]/(main)/kana-chart',
  'app/[locale]/(main)/kanji-practice',
  'app/[locale]/(main)/katakana-practice',
  'app/[locale]/(main)/learn-hiragana',
  'app/[locale]/(main)/learn-katakana',
  'app/[locale]/(main)/kana/learn-hiragana',
  'app/[locale]/(main)/kana/learn-katakana',
  ...['n1', 'n2', 'n3', 'n4', 'n5'].flatMap(level => [
    `app/[locale]/(main)/kanji/jlpt-${level}`,
    `app/[locale]/(main)/vocabulary/jlpt-${level}`,
  ]),
  'proxy.ts',
  'middleware.ts',
  'public/sw.js',
  'public/sitemap.xml',
  'public/robots.txt',
];
for (const path of removed)
  rmSync(join(work, path), { recursive: true, force: true });

// 3. Static export settings.
log('patching the copy for a static export');
{
  const configPath = join(work, 'next.config.ts');
  const config = readFileSync(configPath, 'utf8');
  const cut = config.indexOf('export default withSentryConfig(');
  if (cut < 0) throw new Error('next.config.ts: export default not found');
  writeFileSync(
    configPath,
    `${config.slice(0, cut)}
export default withNextIntl({
  ...nextConfig,
  output: 'export',
  trailingSlash: false,
  images: { ...nextConfig.images, unoptimized: true },
  headers: undefined,
});
`,
  );
}

// The root layout reads the locale from a request header; offline it is always English
// (the Russian overlay then translates the interface).
patch(
  'app/layout.tsx',
  `  const headersList = await headers();
  const locale = headersList.get('x-locale') || 'en';`,
  `  const locale: string = 'en';`,
);
patch(
  'core/i18n/request.ts',
  'getRequestConfig(async ({ locale }) => {',
  "getRequestConfig(async () => {\n  const locale: string | undefined = 'en';",
);

// Pages ask for hourly regeneration on the server; a static export has none.
walk(join(work, 'app'), path => {
  if (!/\.(tsx?|jsx?)$/.test(path)) return;
  const text = readFileSync(path, 'utf8');
  const next = text.replace(/^export const revalidate = .*$/gm, '');
  if (next !== text) writeFileSync(path, next);
});

// Academy, tools and experiments are not part of the offline app.
patch(
  'shared/ui-composite/Menu/Sidebar.tsx',
  'secondaryNavSections.map(section => {',
  '([] as NavSection[]).map(section => {',
);

// Three interface fonts instead of 35 (each Japanese font is ~120 files);
// floating decorations use the system font.
writeFileSync(
  join(work, 'features/Preferences/data/fonts/fonts.prod.ts'),
  `import { Klee_One, Noto_Sans_JP, Zen_Maru_Gothic } from 'next/font/google';

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
});

const notoSansJP = Noto_Sans_JP({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

const kleeOne = Klee_One({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

const fonts = [
  { name: 'Zen Maru Gothic', font: zenMaruGothic },
  { name: 'Noto Sans JP', font: notoSansJP },
  { name: 'Klee One', font: kleeOne },
];

export default fonts;
`,
);
writeFileSync(
  join(work, 'shared/ui-composite/Decorations/decorationFonts.prod.ts'),
  `export const decorationFonts: { name: string; font: { className: string } }[] = [];\n`,
);

// 4. Build.
log('building (next build, static export)');
rmSync(join(work, '.next'), { recursive: true, force: true });
rmSync(join(work, 'out'), { recursive: true, force: true });
try {
  run('node scripts/generate-commit-info.mjs');
} catch {
  log('commit info skipped');
}
run('npx next build', work, {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SOURCE_URL: sourceUrl,
  NEXT_PUBLIC_STANDALONE: '1',
  // Behave like the production site (no preview-only welcome screen or test achievements).
  NEXT_PUBLIC_VERCEL_ENV: 'production',
});

// 5. Lay the English pages out at the root: /kana -> kana.html, / -> index.html.
log('laying out the exported files');
const out = join(work, 'out');
for (const name of readdirSync(out)) {
  if (name === 'es' || name.startsWith('es.')) {
    rmSync(join(out, name), { recursive: true, force: true });
  }
}
const en = join(out, 'en');
if (existsSync(en)) {
  walk(en, path => {
    const target = join(out, relative(en, path));
    mkdirSync(dirname(target), { recursive: true });
    renameSync(path, target);
  });
  rmSync(en, { recursive: true, force: true });
}
for (const ext of ['html', 'txt']) {
  const from = join(out, `en.${ext}`);
  if (existsSync(from)) renameSync(from, join(out, `index.${ext}`));
}

// 6. The Android bridge (speech, external links) loads before the app.
cpSync(join(here, 'bridge.js'), join(out, 'standalone/bridge.js'));
let pages = 0;
walk(out, path => {
  if (!path.endsWith('.html')) return;
  const html = readFileSync(path, 'utf8');
  if (html.includes('/standalone/bridge.js')) return;
  writeFileSync(
    path,
    html.replace(
      '<head>',
      '<head><script src="/standalone/bridge.js"></script>',
    ),
  );
  pages++;
});
log(`bridge added to ${pages} pages`);

// 7. Hand the files to the Android project.
rmSync(assetsDir, { recursive: true, force: true });
mkdirSync(dirname(assetsDir), { recursive: true });
cpSync(out, assetsDir, { recursive: true });
log(`done: ${relative(root, assetsDir)}`);
