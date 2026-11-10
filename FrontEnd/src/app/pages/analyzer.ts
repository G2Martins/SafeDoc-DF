import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EXEMPLOS, MAX_TEXT_LENGTH, tipoLabel } from '../data/site';
import { Icon } from '../shared/icon';
import { DocView, ScoreMeter, STATUS_INFO, StatusPill, baixar, carimbo } from '../shared/ui';
import { Analisador } from '../state';

/** The live text analyzer. Own file so the home can hydrate it lazily (@defer hydrate on viewport). */
@Component({
  selector: 'app-analyzer',
  imports: [Icon, DocView, ScoreMeter, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="analisar" class="wrap scroll-mt-20 py-12" aria-labelledby="analisar-title">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="eyebrow">Análise de texto</p>
          <h2 id="analisar-title" class="h2 mt-3 text-[30px] sm:text-[40px]">Cole um pedido e veja o que vaza</h2>
        </div>
        <p class="flex max-w-md items-start gap-2 text-[14px] text-ink-2">
          <app-icon name="lock" [size]="16" class="mt-0.5 text-brand" />
          A análise acontece enquanto você digita, aqui no navegador. O texto não é enviado nem guardado.
        </p>
      </div>

      <div class="mt-8 grid gap-7 lg:grid-cols-2">
        <div class="card p-5 sm:p-6">
          <div class="flex flex-wrap gap-2" role="group" aria-label="Exemplos de pedido">
            @for (e of exemplos; track e.label; let i = $index) {
              <button type="button" class="chip" [attr.aria-pressed]="a.exemplo() === i" (click)="usar(i)">{{ e.label }}</button>
            }
          </div>
          <label for="texto" class="mt-5 block text-[13px] font-medium">Texto do pedido</label>
          <textarea id="texto" class="field mono mt-2 min-h-[280px] resize-y text-[13px] leading-relaxed" spellcheck="false"
                    [value]="a.texto()" (input)="digitar($event)" [maxLength]="max"
                    placeholder="Cole aqui o texto do pedido de acesso à informação ou do processo SEI..."></textarea>
          <div class="mt-3 flex items-center justify-between gap-3 text-[12px] text-dim">
            <span class="mono num">{{ a.texto().length.toLocaleString('pt-BR') }} / {{ max.toLocaleString('pt-BR') }} caracteres</span>
            <button type="button" class="btn btn-sm btn-line" (click)="limpar()" [disabled]="!a.texto()"><app-icon name="x" [size]="14" /> Limpar</button>
          </div>
        </div>

        <div class="card flex min-w-0 flex-col p-5 sm:p-6">
          <div class="flex flex-wrap items-center gap-3">
            <app-status [status]="a.analise().status" />
            <p class="text-[13px] text-ink-2">{{ info().texto }}</p>
          </div>
          <p class="sr-only" aria-live="polite">{{ resumo() }}</p>
          <app-score class="mt-5 block" [score]="a.analise().score" [status]="a.analise().status" />

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap gap-1.5">
              @for (t of a.tipos(); track t.tipo) { <span class="tag">{{ t.label }} <b class="text-ink">{{ t.n }}</b></span> }
              @empty { <span class="text-[13px] text-dim">Nenhuma ocorrência.</span> }
            </div>
            <div class="inline-flex rounded-lg border border-line-2 p-0.5" role="group" aria-label="Modo de exibição">
              <button type="button" class="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px]" [class.bg-ink]="!a.tarjar()" [class.text-white]="!a.tarjar()"
                      [attr.aria-pressed]="!a.tarjar()" (click)="a.tarjar.set(false)"><app-icon name="highlighter" [size]="13" /> Destacar</button>
              <button type="button" class="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px]" [class.bg-ink]="a.tarjar()" [class.text-white]="a.tarjar()"
                      [attr.aria-pressed]="a.tarjar()" (click)="a.tarjar.set(true)"><app-icon name="redact" [size]="13" /> Tarjar</button>
            </div>
          </div>

          <div class="panel mt-4 max-h-[360px] min-h-[160px] flex-1 overflow-auto bg-bg/60 p-4" tabindex="0" aria-label="Texto com os dados pessoais marcados">
            @if (a.texto().trim()) {
              <app-doc [texto]="a.texto()" [spans]="a.detalhe().spans" [mapa]="a.detalhe().mapa" [tarjar]="a.tarjar()" />
            } @else {
              <p class="text-[14px] text-dim">Cole um texto ou escolha um exemplo para ver os dados marcados aqui.</p>
            }
          </div>
        </div>
      </div>

      <div class="mt-7 grid gap-7 lg:grid-cols-[1.25fr_1fr]">
        <div class="card min-w-0 p-5 sm:p-6">
          <h3 class="flex items-baseline gap-2 text-[17px] font-medium">Ocorrências <span class="mono text-[13px] text-dim">{{ a.analise().total_matches }}</span></h3>
          @if (a.analise().matches.length) {
            <div class="mt-4 overflow-x-auto">
              <table class="w-full min-w-[520px] text-left text-[13px]">
                <thead class="text-[11px] uppercase tracking-[0.08em] text-dim">
                  <tr class="border-b border-line"><th class="py-2 pr-3 font-medium">Tipo</th><th class="py-2 pr-3 font-medium">Valor detectado</th><th class="py-2 pr-3 font-medium">Motivo</th><th class="py-2 text-right font-medium">Peso</th></tr>
                </thead>
                <tbody>
                  @for (m of a.analise().matches; track $index) {
                    <tr class="border-b border-line/70 align-top last:border-0">
                      <td class="py-2.5 pr-3 font-medium whitespace-nowrap">{{ label(m.tipo) }}</td>
                      <td class="mono py-2.5 pr-3 break-all">{{ m.valor_detectado }}</td>
                      <td class="mono py-2.5 pr-3 text-[12px] text-ink-2">{{ m.motivo ?? 'validado' }}</td>
                      <td class="mono py-2.5 text-right">{{ m.score }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="mt-3 text-[14px] text-ink-2">Nada encontrado. Pelas regras, este pedido pode ser publicado.</p>
          }
        </div>

        <div class="card flex min-w-0 flex-col p-5 sm:p-6">
          <h3 class="text-[17px] font-medium">Texto anonimizado</h3>
          <pre class="mono mt-4 max-h-[260px] min-h-[120px] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-line bg-bg/60 p-4 text-[12.5px] leading-relaxed">{{ a.mascarado() || '...' }}</pre>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-primary" (click)="copiar()" [disabled]="!a.mascarado()">
              <app-icon [name]="copiado() ? 'check' : 'copy'" [size]="14" /> {{ copiado() ? 'Copiado' : 'Copiar' }}
            </button>
            <button type="button" class="btn btn-sm btn-line" (click)="baixarTxt()" [disabled]="!a.mascarado()"><app-icon name="download" [size]="14" /> TXT</button>
            <button type="button" class="btn btn-sm btn-line" (click)="baixarJson()"><app-icon name="download" [size]="14" /> JSON da API</button>
          </div>
          <p class="mt-3 text-[12px] leading-relaxed text-dim">
            Aqui as quebras de linha são mantidas. O JSON traz a resposta exata de <span class="mono">POST /validate/text</span>, com o texto normalizado em uma linha.
          </p>
        </div>
      </div>
    </section>
  `,
})
export class Analyzer {
  protected a = inject(Analisador);
  protected exemplos = EXEMPLOS;
  protected max = MAX_TEXT_LENGTH;
  protected label = tipoLabel;
  protected copiado = signal(false);
  protected info = computed(() => STATUS_INFO[this.a.analise().status]);
  protected resumo = computed(() => {
    const r = this.a.analise();
    return `${r.status}: score ${r.score}, ${r.total_matches} ${r.total_matches === 1 ? 'ocorrência' : 'ocorrências'}.`;
  });

  protected usar(i: number) {
    this.a.texto.set(EXEMPLOS[i].texto);
    this.a.exemplo.set(i);
  }
  protected digitar(e: Event) {
    this.a.texto.set((e.target as HTMLTextAreaElement).value);
    this.a.exemplo.set(-1);
  }
  protected limpar() {
    this.a.texto.set('');
    this.a.exemplo.set(-1);
  }
  protected async copiar() {
    try {
      await navigator.clipboard.writeText(this.a.mascarado());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      // Clipboard blocked (permissions or insecure context): the text stays selectable in the box.
    }
  }
  protected baixarTxt() {
    baixar(`safedoc-texto-anonimizado-${carimbo()}.txt`, this.a.mascarado(), 'text/plain;charset=utf-8');
  }
  protected baixarJson() {
    baixar(`safedoc-validate-text-${carimbo()}.json`, JSON.stringify(this.a.analise(), null, 2), 'application/json;charset=utf-8');
  }
}
