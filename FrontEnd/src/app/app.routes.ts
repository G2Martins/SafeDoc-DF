import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'lote', loadComponent: () => import('./pages/batch').then((m) => m.Batch) },
  { path: 'como-funciona', loadComponent: () => import('./pages/how').then((m) => m.How) },
  { path: '**', loadComponent: () => import('./pages/not-found').then((m) => m.NotFound) },
];
