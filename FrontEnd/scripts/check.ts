// Post-build smoke check (npm run check, also part of build:pages). Exits 1 on any failure.
// SEO essentials per prerendered page, trailing-slash links, privacy (nothing loaded from other origins),
// and no em dash anywhere a visitor can read.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { AMOSTRAS, DISCLAIMER, PAGES, SITE_URL } from '../src/app/data/site.ts';

const root = new URL('../dist/safedoc-df/browser/', import.meta.url);
const file = (p: string) => new URL(p.replace(/^\//, ''), root);
const fails: string[] = [];
const must = (ok: unknown, msg: string) => ok || fails.push(msg);
const attr = (h: string, re: RegExp) => h.match(re)?.[1].replace(/&amp;/g, '&') ?? '';

const sitemap = readFileSync(file('sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE_URL, ''));
must(urls.length === PAGES.length, `sitemap has ${urls.length} urls, expected ${PAGES.length}`);

for (const u of urls) {
  if (!existsSync(file(`${u}index.html`))) { fails.push(`not prerendered: ${u}`); continue; }
  const h = readFileSync(file(`${u}index.html`), 'utf8');
  const title = attr(h, /<title>([^<]*)<\/title>/);
  const desc = attr(h, /<meta name="description" content="([^"]*)"/);
  must((h.match(/<h1[\s>]/g) ?? []).length === 1, `${u}: expected exactly one <h1>`);
  must(title && title.length <= 160, `${u}: title missing or > 160 chars (${title.length})`);
  must(desc.length >= 70 && desc.length <= 160, `${u}: description must be 70-160 chars (${desc.length})`);
  must(h.includes(`<link rel="canonical" href="${SITE_URL}${u}">`), `${u}: canonical mismatch`);
  must(h.includes('index, follow'), `${u}: robots meta missing`);
  must(h.includes(DISCLAIMER), `${u}: disclaimer missing`);
  must(h.includes('http-equiv="Content-Security-Policy"'), `${u}: CSP meta missing`);
  const ld = h.match(/<script id="ld-json" type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
  try {
    const graph = JSON.parse(ld ?? '')['@graph'] as { '@type': string; offers?: unknown; aggregateRating?: unknown }[];
    must(graph.some((n) => n['@type'] === 'WebSite'), `${u}: WebSite JSON-LD missing`);
    const app = graph.find((n) => n['@type'] === 'WebApplication');
    must(app && !app.offers && !app.aggregateRating, `${u}: WebApplication JSON-LD missing or with offers/ratings`);
  } catch { fails.push(`${u}: invalid JSON-LD`); }
  // Internal page links must end in '/': GitHub Pages answers /path with a 301 to /path/.
  for (const [, href] of h.matchAll(/href="(\/[^"#?]*)/g))
    must(href.endsWith('/') || /\.[a-z0-9]+$/i.test(href), `${u}: link without trailing slash ${href}`);
  for (const [, href] of h.matchAll(/href="(https:\/\/g2portfolio[^"#?]*)/g)) must(href.endsWith('/'), `${u}: portfolio link without trailing slash ${href}`);
  // Privacy: no script, style, font or preconnect from another origin.
  must(!/<script[^>]+src="(https?:)?\/\//.test(h), `${u}: external script`);
  must(!/<link[^>]+rel="(stylesheet|preconnect|preload|modulepreload|dns-prefetch)"[^>]+href="(https?:)?\/\//.test(h), `${u}: external stylesheet/preconnect`);
}

const walk = (dir: URL): URL[] => readdirSync(dir).flatMap((n) => {
  const p = new URL(n, dir);
  return statSync(p).isDirectory() ? walk(new URL(`${n}/`, dir)) : [p];
});
for (const f of walk(root)) {
  const name = f.pathname.split('/browser/')[1];
  if (!/\.(html|js|css|json|txt|xml|webmanifest)$/.test(name) || name.endsWith('3rdpartylicenses.txt')) continue;
  const text = readFileSync(f, 'utf8');
  must(!text.includes(String.fromCharCode(0x2014)), `em dash in ${name}`);
  if (name.endsWith('.css')) must(!/url\((["']?)(https?:)?\/\//.test(text), `external url() in ${name}`);
  if (name.endsWith('.js')) must(!/google-analytics|googletagmanager|gtag\(|plausible|hotjar|sentry/i.test(text), `analytics/telemetry in ${name}`);
}
for (const f of ['robots.txt', 'sitemap.xml', 'site.webmanifest', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og/safedoc-df.png', 'fonts/geist.woff2', 'fonts/geist-mono.woff2', 'index.csr.html', ...AMOSTRAS.map((a) => a.arquivo)])
  must(existsSync(file(f)), `missing /${f}`);

if (fails.length) { console.error(`check: ${fails.length} problem(s)\n- ` + [...new Set(fails)].join('\n- ')); process.exit(1); }
console.log(`check: ${urls.length} urls OK, trailing slashes OK, no external assets, no em dash`);
