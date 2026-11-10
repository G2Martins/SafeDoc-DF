// Publishes the static build to the repo-root /docs (GitHub Pages source: main branch, /docs folder, base /SafeDoc-DF/).
import { cp, readFile, rm, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/safedoc-df/browser/', import.meta.url);
const docs = new URL('../../docs/', import.meta.url);

// ponytail: async cp on purpose: Node 22's native cpSync exits 127 silently on non-ASCII paths ("Programação").
await rm(docs, { recursive: true, force: true });
await cp(dist, docs, { recursive: true });
await writeFile(new URL('.nojekyll', docs), '');
// Unknown URLs boot the client app (router shows the 404 page); the shell must not be indexed.
const shell = await readFile(new URL('index.csr.html', dist), 'utf8');
await writeFile(new URL('404.html', docs), shell.replace('<head>', '<head><meta name="robots" content="noindex, follow">'));
console.log('pages: FrontEnd/dist/safedoc-df/browser -> docs/ (+ .nojekyll, 404.html)');
