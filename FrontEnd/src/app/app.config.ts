import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay, withIncrementalHydration } from '@angular/platform-browser';
import { UrlSerializer, provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { TrailingSlashSerializer } from './shared/trailing-slash';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    { provide: UrlSerializer, useClass: TrailingSlashSerializer },
  ],
};
