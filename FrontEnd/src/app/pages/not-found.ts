import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../shared/seo';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap py-28 text-center">
      <p class="eyebrow justify-center">Erro 404</p>
      <h1 class="h-display mt-4 text-[44px] sm:text-[60px]">Página não encontrada</h1>
      <p class="mx-auto mt-4 max-w-md text-ink-2">Esta página não existe no SafeDoc-DF. Volte para a análise de texto ou envie um CSV.</p>
      <div class="mt-8 flex justify-center gap-2">
        <a routerLink="/" class="btn btn-primary">Analisar um texto</a>
        <a routerLink="/lote" class="btn btn-line">Análise em lote</a>
      </div>
    </div>
  `,
})
export class NotFound {
  constructor() {
    inject(Seo).set({ title: 'Página não encontrada | SafeDoc-DF', description: 'Esta página não existe no SafeDoc-DF, detector de dados pessoais em pedidos de acesso à informação.', path: '/404/', noindex: true });
  }
}
