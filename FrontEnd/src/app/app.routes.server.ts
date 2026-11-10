import { RenderMode, ServerRoute } from '@angular/ssr';

// Every real page is prerendered to static HTML (GitHub Pages, no server). The analysis itself runs in the browser.
// Unknown URLs render in the client from 404.html (scripts/pages.ts).
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'lote', renderMode: RenderMode.Prerender },
  { path: 'como-funciona', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
