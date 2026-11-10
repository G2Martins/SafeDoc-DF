import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TIPOS } from '../data/site';
import { Icon } from '../shared/icon';
import { Seo } from '../shared/seo';
import { Analyzer } from './analyzer';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, Analyzer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Hero: copy is painted at once (LCP); only the decorative bars animate. -->
    <section class="wrap pt-12 pb-10 sm:pt-20">
      <div class="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <p class="eyebrow">Desafio Participa DF · LAI · LGPD</p>
          <h1 class="h-display mt-5 text-[40px] sm:text-[58px] lg:text-[66px]">
            Proteção de dados para o <span class="hero-mark">acesso à informação</span>
          </h1>
          <p class="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Identifique CPF, RG, telefone, e-mail, processos e outros dados pessoais em pedidos de acesso à informação,
            veja o risco de publicar e leve o texto anonimizado. O motor de regras é o mesmo da API em Python, agora
            rodando no seu navegador.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a href="#analisar" class="btn btn-primary">Testar com um texto <app-icon name="arrow-right" [size]="16" /></a>
            <a routerLink="/lote" class="btn btn-line"><app-icon name="upload" [size]="16" /> Analisar um CSV</a>
          </div>
          <ul class="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-[13px] text-ink-2 sm:grid-cols-4">
            @for (f of fatos; track f.v) {
              <li><span class="block text-[22px] font-medium tracking-[-0.03em] text-ink">{{ f.v }}</span>{{ f.l }}</li>
            }
          </ul>
        </div>

        <figure class="card ticks relative mx-auto w-full max-w-[520px] p-6 sm:p-7" aria-label="Exemplo de pedido com dados pessoais tarjados">
          <div class="flex items-center justify-between gap-3 border-b border-dashed border-line pb-3">
            <span class="eyebrow">Pedido e-SIC</span>
            <span class="status status-BLOQUEAR"><app-icon name="block" [size]="14" />BLOQUEAR</span>
          </div>
          <p class="doc mt-4 text-[14.5px]" aria-hidden="true">Solicito cópia do processo <span class="bar" style="--d: 300ms">00015-01234567/2023-11</span>.
Requerente: <span class="bar" style="--d: 500ms">Juliana Costa Albuquerque</span>, CPF <span class="bar" style="--d: 700ms">529.982.247-25</span>, telefone <span class="bar" style="--d: 900ms">(61) 99876-5432</span>, e-mail <span class="bar" style="--d: 1100ms">juliana@email.com</span>.</p>
          <figcaption class="mt-5 flex flex-wrap gap-1.5 border-t border-dashed border-line pt-4">
            @for (t of heroTags; track t) { <span class="tag">{{ t }}</span> }
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Analyzer: prerendered, hydrated only when it scrolls into view (keeps the first load light on phones). -->
    @defer (on immediate; hydrate on viewport) {
      <app-analyzer />
    } @placeholder {
      <!-- Client-side navigation only: keeps the #analisar anchor and the height while the chunk loads. -->
      <div id="analisar" class="min-h-[1200px]"></div>
    }

    <!-- Next steps -->
    <section class="wrap py-10">
      <div class="grid gap-7 md:grid-cols-2">
        <a routerLink="/lote" class="card group block p-6 transition-colors hover:border-brand">
          <span class="eyebrow">Em lote</span>
          <p class="h2 mt-3 text-[24px]">Um CSV inteiro, linha a linha</p>
          <p class="mt-2 text-[14px] text-ink-2">Envie um arquivo ou use as amostras do desafio: painel de risco, tabela por pedido e CSV anonimizado para baixar. O arquivo não sai do seu computador.</p>
          <span class="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand">Abrir análise em lote <app-icon name="arrow-right" [size]="15" /></span>
        </a>
        <a routerLink="/como-funciona" class="card group block p-6 transition-colors hover:border-brand">
          <span class="eyebrow">Como funciona</span>
          <p class="h2 mt-3 text-[24px]">{{ regras }} regras, um score, três ações</p>
          <p class="mt-2 text-[14px] text-ink-2">Normalização, regex com validação de dígito e de contexto, desempate por prioridade e pontuação. Com os limites de uma abordagem por regras.</p>
          <span class="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand">Ver as regras <app-icon name="arrow-right" [size]="15" /></span>
        </a>
      </div>
    </section>
  `,
  styles: `
    .hero-mark {
      background: linear-gradient(transparent 58%, var(--marker) 58%, var(--marker) 95%, transparent 95%);
      -webkit-box-decoration-break: clone; box-decoration-break: clone; padding-inline: .04em;
    }
    .bar { position: relative; border-radius: 2px; background: var(--marker-soft); -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    .bar::after {
      content: ""; position: absolute; inset: -1px -1px; border-radius: 2px; background: var(--ink);
      transform-origin: left; animation: wipe 700ms var(--ease-out-expo) var(--d, 0ms) both;
    }
    @media (prefers-reduced-motion: reduce) { .bar::after { animation: none; } }
  `,
})
export class Home {
  protected regras = Object.keys(TIPOS).length;
  protected fatos = [
    { v: String(this.regras), l: 'regras de detecção' },
    { v: '3', l: 'níveis de risco' },
    { v: '0 bytes', l: 'enviados a servidor' },
    { v: '100%', l: 'no navegador' },
  ];
  protected heroTags = ['Processo', 'Nome', 'CPF', 'Telefone', 'E-mail'];

  constructor() {
    inject(Seo).set({
      title: 'SafeDoc-DF | Detector de dados pessoais em pedidos LAI',
      description: 'Encontre CPF, RG, telefone, e-mail e outros dados pessoais em pedidos de acesso à informação, veja o risco e baixe o texto anonimizado. Roda no navegador.',
      path: '/',
    });
  }
}
