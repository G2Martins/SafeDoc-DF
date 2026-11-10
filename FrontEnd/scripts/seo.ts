// Runs before every build: writes public/sitemap.xml and public/robots.txt, copies the sample CSVs from
// BackEnd/data/input (single source) to public/amostras/ so the batch page can load them with one click, and copies
// the Geist latin fonts to public/fonts/ under stable names so index.html can preload them (no layout shift).
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { AMOSTRAS, PAGES, SITE_URL } from '../src/app/data/site.ts';

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>
`;

// ponytail: GitHub Pages project sites cannot own the domain-root robots.txt; this copy documents intent and points
// to the sitemap (submit it in Search Console).
const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

const pub = new URL('../public/', import.meta.url);
await writeFile(new URL('sitemap.xml', pub), sitemap);
await writeFile(new URL('robots.txt', pub), robots);
await mkdir(new URL('amostras/', pub), { recursive: true });
await mkdir(new URL('fonts/', pub), { recursive: true });
for (const [pkg, name] of [['geist', 'geist'], ['geist-mono', 'geist-mono']])
  await cp(new URL(`../node_modules/@fontsource-variable/${pkg}/files/${pkg}-latin-wght-normal.woff2`, import.meta.url), new URL(`fonts/${name}.woff2`, pub));
for (const a of AMOSTRAS) await cp(new URL(`../../BackEnd/data/input/${encodeURIComponent(a.origem)}`, import.meta.url), new URL(a.arquivo, pub));
console.log(`seo: sitemap.xml with ${PAGES.length} urls, robots.txt, ${AMOSTRAS.length} sample CSVs, 2 fonts`);
