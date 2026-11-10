import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AMOSTRAS } from '../data/site';
import { escreverCsv } from '../engine/csv';
import { Status, TEXT_COLUMN_CANDIDATES } from '../engine/detector';
import { Icon } from '../shared/icon';
import { Seo } from '../shared/seo';
import { DocView, STATUS_INFO, STATUS_ORDER, StatusPill, baixar, carimbo, contarTipos, mascarar } from '../shared/ui';
import { Lote } from '../state';

const MAX_BYTES = 5 * 1024 * 1024;
const PAGINA = 25;

@Component({
  selector: 'app-batch',
  imports: [Icon, DocView, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap pt-12 pb-8 sm:pt-16">
      <p class="eyebrow">Análise em lote</p>
      <h1 class="h-display mt-5 max-w-3xl text-[38px] sm:text-[54px]">Um CSV de pedidos, analisado linha a linha</h1>
      <p class="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">
        Carregue um arquivo .csv ou use as amostras do desafio. O arquivo é lido pelo próprio navegador e processado aqui:
        não existe servidor, nada é enviado e nada fica guardado depois que você fecha a aba.
      </p>

      <div class="mt-9 grid gap-7 lg:grid-cols-[1.25fr_1fr]">
        <label class="card flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed p-8 text-center transition-colors hover:border-brand focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-brand"
               [class.border-brand]="arrastando()" (dragover)="sobre($event)" (dragleave)="arrastando.set(false)" (drop)="soltar($event)">
          <input type="file" accept=".csv,text/csv" class="sr-only" (change)="escolher($event)" />
          <span class="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand"><app-icon name="upload" [size]="22" /></span>
          <span class="text-[16px] font-medium">Arraste um CSV aqui ou clique para escolher</span>
          <span class="max-w-md text-[13px] text-ink-2">
            Até 5 MB, separado por vírgula ou ponto e vírgula. A coluna de texto é achada pelos nomes que a API aceita
            (<span class="mono text-[12px]">{{ candidatos }}</span>); se não houver, a de textos mais longos.
          </span>
        </label>

        <div class="card p-6">
          <p class="eyebrow">Amostras do desafio</p>
          <ul class="mt-4 space-y-4">
            @for (s of amostras; track s.arquivo) {
              <li class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-[15px] font-medium">{{ s.label }}</p>
                  <p class="text-[13px] text-ink-2">{{ s.descricao }}</p>
                </div>
                <button type="button" class="btn btn-sm btn-line shrink-0" (click)="amostra(s.arquivo, s.origem)" [disabled]="carregando()">
                  <app-icon name="file" [size]="14" /> Carregar
                </button>
              </li>
            }
          </ul>
          <p class="mt-5 flex items-start gap-2 border-t border-dashed border-line pt-4 text-[12px] text-dim">
            <app-icon name="lock" [size]="14" class="mt-0.5" /> As amostras vêm do próprio site, como qualquer arquivo estático. O que você carrega do seu computador não sai dele.
          </p>
        </div>
      </div>

      @if (lote.erro()) {
        <p class="mt-6 flex items-center gap-2 rounded-xl border border-crit/40 bg-crit/5 px-4 py-3 text-[14px] text-crit-ink" role="alert">
          <app-icon name="alert" [size]="16" /> {{ lote.erro() }}
        </p>
      }
    </section>

    @if (lote.linhas().length) {
      <section class="wrap py-6" aria-labelledby="painel-title">
        <div class="panel flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <div class="min-w-0">
            <h2 id="painel-title" class="truncate text-[16px] font-medium">{{ lote.nome() }}</h2>
            <p class="mono text-[12px] text-dim">{{ lote.linhas().length }} linhas · separador "{{ lote.sep() === '\t' ? 'tab' : lote.sep() }}"</p>
          </div>
          <label class="flex items-center gap-2 text-[13px] text-ink-2">
            Coluna analisada
            <select class="field w-auto py-2 text-[13px]" (change)="trocarColuna($event)">
              @for (h of lote.header(); track $index) { <option [value]="$index" [selected]="$index === lote.coluna()">{{ h || 'coluna ' + ($index + 1) }}</option> }
            </select>
          </label>
          <div class="ml-auto flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-primary" (click)="baixarCsv()"><app-icon name="download" [size]="14" /> CSV anonimizado</button>
            <button type="button" class="btn btn-sm btn-line" (click)="baixarJson()"><app-icon name="download" [size]="14" /> JSON da API</button>
          </div>
          @if (lote.colunaApi() < 0) {
            <p class="w-full text-[12px] text-warn-ink">A API recusaria este arquivo ("Nenhuma coluna de texto encontrada"). A demo escolheu a coluna de textos mais longos; troque acima se precisar.</p>
          }
        </div>

        <!-- Dashboard -->
        <div class="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
          @for (s of stats(); track s.label) {
            <div class="card p-4 sm:p-5">
              <p class="text-[13px] text-ink-2">{{ s.label }}</p>
              <p class="mt-1 text-[24px] font-semibold tracking-[-0.03em] sm:text-[30px]">{{ s.valor }}</p>
              <p class="truncate text-[12px] text-dim">{{ s.nota }}</p>
            </div>
          }
        </div>

        <div class="mt-7 grid items-start gap-7 lg:grid-cols-[1fr_1.15fr]">
          <div class="grid gap-7">
            <div class="card p-5 sm:p-6">
              <h3 class="text-[16px] font-medium">Distribuição de risco</h3>
              <p class="text-[13px] text-ink-2">Ação sugerida para cada pedido</p>
              <div class="mt-5 flex h-4 gap-[2px]" role="img" [attr.aria-label]="riscoAria()">
                @for (r of risco(); track r.status) {
                  @if (r.n) {
                    <div class="tip-host anim-grow first:rounded-l-[4px] last:rounded-r-[4px]" tabindex="0" [class]="'fill-' + r.status" [style.width.%]="r.pct">
                      <span class="tip">{{ r.status }}: {{ r.n }} ({{ r.pct.toFixed(1) }}%)</span>
                    </div>
                  }
                }
              </div>
              <ul class="mt-5 space-y-2.5">
                @for (r of risco(); track r.status) {
                  <li class="flex items-center gap-3 text-[14px]">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-sm" [class]="'fill-' + r.status" aria-hidden="true"></span>
                    <app-status [status]="r.status" />
                    <span class="mono num ml-auto">{{ r.n }}</span>
                    <span class="mono num w-14 text-right text-[12px] text-dim">{{ r.pct.toFixed(1) }}%</span>
                  </li>
                }
              </ul>
            </div>

            @if (lote.metricas(); as m) {
              <div class="card p-5 sm:p-6">
                <div>
                  <h3 class="text-[16px] font-medium">Avaliação contra a coluna y_true</h3>
                  <p class="text-[13px] text-ink-2">Positivo previsto = status REVISAR ou BLOQUEAR. A coluna y_pred do arquivo é ignorada.</p>
                </div>
                <div class="mt-5 grid gap-5">
                  <div class="grid grid-cols-3 gap-3">
                    @for (k of [{ l: 'Precisão', v: m.precisao }, { l: 'Recall', v: m.recall }, { l: 'F1', v: m.f1 }]; track k.l) {
                      <div class="rounded-xl border border-line bg-bg/60 p-3 sm:p-4">
                        <p class="text-[13px] text-ink-2">{{ k.l }}</p>
                        <p class="mt-1 text-[22px] font-semibold tracking-[-0.03em] sm:text-[26px]">{{ (100 * k.v).toFixed(1) }}%</p>
                      </div>
                    }
                  </div>
                  <table class="mono num w-full max-w-sm text-center text-[13px]" aria-label="Matriz de confusão">
                    <thead><tr class="text-[11px] text-dim"><th></th><th class="px-3 pb-1 font-normal">previsto 1</th><th class="px-3 pb-1 font-normal">previsto 0</th></tr></thead>
                    <tbody>
                      <tr><th class="pr-3 text-right text-[11px] font-normal text-dim">real 1</th><td class="border border-line px-4 py-2">VP {{ m.vp }}</td><td class="border border-line px-4 py-2">FN {{ m.fn }}</td></tr>
                      <tr><th class="pr-3 text-right text-[11px] font-normal text-dim">real 0</th><td class="border border-line px-4 py-2">FP {{ m.fp }}</td><td class="border border-line px-4 py-2">VN {{ m.vn }}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>

          <div class="card p-5 sm:p-6">
            <h3 class="text-[16px] font-medium">Ocorrências por tipo de dado</h3>
            <p class="text-[13px] text-ink-2">Depois de resolver sobreposições, como a API conta</p>
            @if (lote.tipos().length) {
              <ul class="mt-5 space-y-2">
                @for (t of lote.tipos(); track t.tipo) {
                  <li class="tip-host grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-md text-[13px]" tabindex="0" [style.--tip-x]="'60%'">
                    <span class="truncate text-ink-2">{{ t.label }}</span>
                    <span class="flex items-center gap-2">
                      <span class="anim-grow block h-3 rounded-r-[4px] bg-brand" [style.width.%]="(100 * t.n) / lote.tipos()[0].n * 0.86"></span>
                      <span class="mono num text-[12px]">{{ t.n }}</span>
                    </span>
                    <span class="tip">{{ t.label }}: {{ t.n }} {{ t.n === 1 ? 'ocorrência' : 'ocorrências' }} em {{ lote.linhasPorTipo().get(t.tipo) }} {{ lote.linhasPorTipo().get(t.tipo) === 1 ? 'pedido' : 'pedidos' }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="mt-5 text-[14px] text-ink-2">Nenhum dado pessoal encontrado no arquivo.</p>
            }
          </div>
        </div>

        <!-- Rows -->
        <div class="card mt-7 p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-[16px] font-medium">Pedidos</h3>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
              <button type="button" class="chip" [attr.aria-pressed]="filtro() === null" (click)="filtrar(null)">Todos <b>{{ lote.linhas().length }}</b></button>
              @for (s of ordem; track s) {
                <button type="button" class="chip" [attr.aria-pressed]="filtro() === s" (click)="filtrar(s)">{{ info[s].label }} <b>{{ lote.porStatus()[s] }}</b></button>
              }
            </div>
          </div>
          <div class="mt-5 text-[13px]">
            <div class="hidden grid-cols-[3.5rem_8.5rem_3rem_13rem_minmax(0,1fr)_4.5rem] gap-3 border-b border-line pb-2 text-[11px] uppercase tracking-[0.08em] text-dim md:grid" aria-hidden="true">
              <span>ID</span><span>Status</span><span class="text-right">Score</span><span>Dados encontrados</span><span>Texto anonimizado</span><span></span>
            </div>
            <ul>
              @for (l of visiveis(); track l.id + '-' + $index) {
                <li class="border-b border-line/70 py-3 last:border-0">
                  <div class="grid grid-cols-[auto_auto_1fr_auto] items-start gap-x-3 gap-y-2 md:grid-cols-[3.5rem_8.5rem_3rem_13rem_minmax(0,1fr)_4.5rem]">
                    <span class="mono pt-1 text-ink-2"><span class="md:hidden">#</span>{{ l.id }}</span>
                    <span><app-status [status]="l.d.analise.status" /></span>
                    <span class="mono num pt-1 md:text-right"><span class="text-dim md:hidden">score </span>{{ l.d.analise.score }}</span>
                    <span class="col-span-full row-start-2 flex flex-wrap gap-1 md:col-span-1 md:col-start-4 md:row-start-1">
                      @for (t of tiposDe(l.d.analise.matches); track t.tipo) { <span class="tag">{{ t.label }}@if (t.n > 1) { ×{{ t.n }} }</span> }
                      @empty { <span class="pt-1 text-dim">nenhum dado</span> }
                    </span>
                    <p class="mono clamp-2 col-span-full row-start-3 text-[12px] text-ink-2 md:col-span-1 md:col-start-5 md:row-start-1">{{ l.d.analise.texto_anonimizado || '(vazio)' }}</p>
                    <button type="button" class="btn btn-sm btn-line col-start-4 row-start-1 md:col-start-6" [attr.aria-expanded]="aberto() === l" (click)="abrir(l)">{{ aberto() === l ? 'Fechar' : 'Ver' }}</button>
                  </div>
                  @if (aberto() === l) {
                    <div class="mt-3 max-h-[320px] overflow-auto rounded-[10px] border border-line bg-bg/60 p-4" tabindex="0" aria-label="Texto original com os dados marcados">
                      <app-doc class="block text-[14px]" [texto]="l.texto" [spans]="l.d.spans" [mapa]="l.d.mapa" />
                    </div>
                  }
                </li>
              }
            </ul>
          </div>
          @if (filtradas().length > visiveis().length) {
            <div class="mt-5 flex items-center justify-between gap-3 text-[13px] text-ink-2">
              <span>Mostrando {{ visiveis().length }} de {{ filtradas().length }}</span>
              <button type="button" class="btn btn-sm btn-line" (click)="limite.set(limite() + pagina)">Mostrar mais {{ pagina }}</button>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class Batch {
  protected lote = inject(Lote);
  protected amostras = AMOSTRAS;
  protected candidatos = TEXT_COLUMN_CANDIDATES.join(', ');
  protected info = STATUS_INFO;
  protected ordem = STATUS_ORDER;
  protected pagina = PAGINA;
  protected carregando = signal(false);
  protected arrastando = signal(false);
  protected filtro = signal<Status | null>(null);
  protected limite = signal(PAGINA);
  protected aberto = signal<unknown>(null);
  protected tiposDe = (matches: { tipo: string }[]) => contarTipos(matches.map((m) => m.tipo));

  protected filtradas = computed(() => {
    const f = this.filtro();
    return f ? this.lote.linhas().filter((l) => l.d.analise.status === f) : this.lote.linhas();
  });
  protected visiveis = computed(() => this.filtradas().slice(0, this.limite()));

  protected risco = computed(() => {
    const c = this.lote.porStatus();
    const total = this.lote.linhas().length || 1;
    return STATUS_ORDER.map((status) => ({ status, n: c[status], pct: (100 * c[status]) / total }));
  });
  protected riscoAria = computed(() => this.risco().map((r) => `${r.status} ${r.n}`).join(', '));

  protected stats = computed(() => {
    const n = this.lote.linhas().length;
    const c = this.lote.porStatus();
    const com = c.BLOQUEAR + c.REVISAR;
    const ocorrencias = this.lote.analises().reduce((s, a) => s + a.total_matches, 0);
    return [
      { label: 'Pedidos analisados', valor: n.toLocaleString('pt-BR'), nota: this.lote.nome() },
      { label: 'Com dados pessoais', valor: `${Math.round((100 * com) / n)}%`, nota: `${com} pedidos para revisar ou bloquear` },
      { label: 'Ocorrências', valor: ocorrencias.toLocaleString('pt-BR'), nota: `${this.lote.tipos().length} tipos de dado` },
      { label: 'Tempo de análise', valor: `${Math.max(1, Math.round(this.lote.resultado().ms))} ms`, nota: 'no seu navegador' },
    ];
  });

  constructor() {
    inject(Seo).set({
      title: 'Análise de CSV em lote | SafeDoc-DF',
      description: 'Envie um CSV de pedidos de acesso à informação e veja os dados pessoais de cada linha, o risco e o arquivo anonimizado. Nada sai do navegador.',
      path: '/lote/',
    });
  }

  protected escolher(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.abrirArquivo(file);
    input.value = '';
  }
  protected sobre(e: DragEvent) {
    e.preventDefault();
    this.arrastando.set(true);
  }
  protected soltar(e: DragEvent) {
    e.preventDefault();
    this.arrastando.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.abrirArquivo(file);
  }

  private async abrirArquivo(file: File) {
    if (file.size > MAX_BYTES) return this.lote.erro.set('Arquivo maior que 5 MB. Divida o CSV em partes menores.');
    const buf = await file.arrayBuffer();
    // UTF-8 first; Excel on Windows often saves Windows-1252.
    let texto: string;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      texto = new TextDecoder('windows-1252').decode(buf);
    }
    this.carregar(file.name, texto);
  }

  protected async amostra(arquivo: string, origem: string) {
    this.carregando.set(true);
    try {
      const r = await fetch(arquivo);
      if (!r.ok) throw new Error(String(r.status));
      this.carregar(origem, await r.text());
    } catch {
      this.lote.erro.set('Não foi possível carregar a amostra.');
    } finally {
      this.carregando.set(false);
    }
  }

  private carregar(nome: string, texto: string) {
    this.lote.carregar(nome, texto);
    this.filtro.set(null);
    this.limite.set(PAGINA);
    this.aberto.set(null);
  }

  protected trocarColuna(e: Event) {
    this.lote.coluna.set(Number((e.target as HTMLSelectElement).value));
    this.aberto.set(null);
  }
  protected filtrar(s: Status | null) {
    this.filtro.set(s);
    this.limite.set(PAGINA);
  }
  protected abrir(l: unknown) {
    this.aberto.set(this.aberto() === l ? null : l);
  }

  protected baixarCsv() {
    const col = this.lote.coluna();
    const header = [...this.lote.header(), 'status', 'score', 'dados_pessoais'];
    const rows = this.lote.linhas().map((l) => {
      const campos = [...l.campos];
      campos[col] = mascarar(l.texto, l.d.spans, l.d.mapa);
      const tipos = contarTipos(l.d.analise.matches.map((m) => m.tipo)).map((t) => `${t.tipo}=${t.n}`).join('; ');
      return [...campos, l.d.analise.status, String(l.d.analise.score), tipos];
    });
    const base = this.lote.nome().replace(/\.csv$/i, '');
    baixar(`${base}-anonimizado-${carimbo()}.csv`, escreverCsv([header, ...rows], this.lote.sep()), 'text/csv;charset=utf-8');
  }
  protected baixarJson() {
    const resultados = this.lote.analises();
    baixar(`safedoc-validate-csv-${carimbo()}.json`, JSON.stringify({ total: resultados.length, resultados }, null, 2), 'application/json;charset=utf-8');
  }
}
