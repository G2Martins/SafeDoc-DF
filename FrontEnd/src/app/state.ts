import { Injectable, computed, signal } from '@angular/core';
import { EXEMPLOS } from './data/site';
import { lerCsv, detectarSeparador } from './engine/csv';
import { Analise, Detalhe, TEXT_COLUMN_CANDIDATES, analisarDetalhado } from './engine/detector';
import { contarTipos, mascarar } from './shared/ui';

/** Text analyzer state. Root-provided so the text survives navigating to other pages. */
@Injectable({ providedIn: 'root' })
export class Analisador {
  readonly texto = signal(EXEMPLOS[0].texto);
  readonly exemplo = signal(0);
  readonly tarjar = signal(false);
  // ponytail: recomputed on every keystroke, no debounce; ~20 ms for the 20 000-character cap.
  readonly detalhe = computed(() => analisarDetalhado(this.texto()));
  readonly analise = computed(() => this.detalhe().analise);
  readonly mascarado = computed(() => mascarar(this.texto(), this.detalhe().spans, this.detalhe().mapa));
  readonly tipos = computed(() => contarTipos(this.analise().matches.map((m) => m.tipo)));
}

export interface Linha {
  /** Value of the ID column, or the row number. */
  id: string;
  campos: string[];
  texto: string;
  d: Detalhe;
}

/** Batch (CSV) state: parsed in memory, never uploaded. */
@Injectable({ providedIn: 'root' })
export class Lote {
  readonly nome = signal('');
  readonly sep = signal(',');
  readonly header = signal<string[]>([]);
  readonly rows = signal<string[][]>([]);
  readonly coluna = signal(-1);
  readonly erro = signal('');

  /** First column the API would accept (TEXT_COLUMN_CANDIDATES), -1 if none. */
  readonly colunaApi = computed(() => this.header().findIndex((c) => TEXT_COLUMN_CANDIDATES.includes(c.toLowerCase())));
  readonly colId = computed(() => this.header().findIndex((c) => c.trim().toLowerCase() === 'id'));
  readonly colRotulo = computed(() => this.header().findIndex((c) => c.trim().toLowerCase() === 'y_true'));

  readonly resultado = computed(() => {
    const col = this.coluna();
    if (col < 0) return { linhas: [] as Linha[], ms: 0 };
    const t0 = performance.now();
    const idCol = this.colId();
    const linhas = this.rows().map((campos, i): Linha => {
      const texto = campos[col] ?? '';
      return { id: idCol >= 0 && campos[idCol] ? campos[idCol] : String(i + 1), campos, texto, d: analisarDetalhado(texto) };
    });
    return { linhas, ms: performance.now() - t0 };
  });
  readonly linhas = computed(() => this.resultado().linhas);
  readonly analises = computed((): Analise[] => this.linhas().map((l) => l.d.analise));

  readonly porStatus = computed(() => {
    const c = { BLOQUEAR: 0, REVISAR: 0, PUBLICAR: 0 };
    for (const a of this.analises()) c[a.status]++;
    return c;
  });
  readonly tipos = computed(() => contarTipos(this.analises().flatMap((a) => a.matches.map((m) => m.tipo))));
  /** Rows containing each type at least once. */
  readonly linhasPorTipo = computed(() => {
    const n = new Map<string, number>();
    for (const a of this.analises()) for (const t of new Set(a.matches.map((m) => m.tipo))) n.set(t, (n.get(t) ?? 0) + 1);
    return n;
  });

  /** Precision/recall against a y_true column: predicted positive = REVISAR or BLOQUEAR. */
  readonly metricas = computed(() => {
    const col = this.colRotulo();
    if (col < 0 || !this.linhas().length) return null;
    let vp = 0, fp = 0, fn = 0, vn = 0;
    for (const l of this.linhas()) {
      const real = l.campos[col]?.trim() === '1';
      const prev = l.d.analise.status !== 'PUBLICAR';
      if (real && prev) vp++;
      else if (!real && prev) fp++;
      else if (real) fn++;
      else vn++;
    }
    const precisao = vp + fp ? vp / (vp + fp) : 0;
    const recall = vp + fn ? vp / (vp + fn) : 0;
    const f1 = precisao + recall ? (2 * precisao * recall) / (precisao + recall) : 0;
    return { vp, fp, fn, vn, precisao, recall, f1 };
  });

  carregar(nome: string, texto: string) {
    const sep = detectarSeparador(texto);
    const rows = lerCsv(texto, sep);
    const [header = [], ...body] = rows;
    this.erro.set(body.length ? '' : 'O arquivo não tem linhas de dados.');
    this.nome.set(nome);
    this.sep.set(sep);
    this.header.set(header);
    this.rows.set(body);
    const api = this.colunaApi();
    // Fallback the API does not have: the column with the longest texts.
    const longa = header.map((_, i) => body.reduce((s, r) => s + (r[i]?.length ?? 0), 0)).reduce((best, v, i, all) => (v > all[best] ? i : best), 0);
    this.coluna.set(header.length ? (api >= 0 ? api : longa) : -1);
  }
}
