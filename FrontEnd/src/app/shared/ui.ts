import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { tipoLabel } from '../data/site';
import { POLITICA, Span, Status } from '../engine/detector';
import { Icon } from './icon';

export const STATUS_INFO: Record<Status, { icon: string; label: string; texto: string }> = {
  PUBLICAR: { icon: 'ok', label: 'Publicar', texto: 'Nenhum dado pessoal relevante encontrado.' },
  REVISAR: { icon: 'alert', label: 'Revisar', texto: `Score entre ${POLITICA.score_revisar} e ${POLITICA.score_bloquear - 1}: alguém precisa olhar antes de publicar.` },
  BLOQUEAR: { icon: 'block', label: 'Bloquear', texto: `Score ${POLITICA.score_bloquear} ou mais: o pedido expõe dados pessoais.` },
};
export const STATUS_ORDER: Status[] = ['BLOQUEAR', 'REVISAR', 'PUBLICAR'];

@Component({
  selector: 'app-status',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="status" [class]="'status status-' + status()"><app-icon [name]="info().icon" [size]="14" />{{ status() }}</span>`,
})
export class StatusPill {
  status = input.required<Status>();
  protected info = computed(() => STATUS_INFO[this.status()]);
}

/** Score meter with the two policy thresholds marked. The fill carries severity; the track stays neutral. */
@Component({
  selector: 'app-score',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-baseline justify-between gap-3 text-[12px] text-ink-2">
      <span>Score de risco</span>
      <span class="mono text-[13px] text-ink"><b class="text-[20px] font-semibold">{{ score() }}</b> pts</span>
    </div>
    <div class="relative mt-2 h-2.5 rounded-full bg-well" role="meter" aria-label="Score de risco" [attr.aria-valuenow]="Math.min(score(), max)" aria-valuemin="0" [attr.aria-valuemax]="max" [attr.aria-valuetext]="score() + ' pontos'">
      <div class="anim-grow h-full rounded-full" [class]="'fill-' + status()" [style.width.%]="(100 * Math.min(score(), max)) / max"></div>
      @for (t of ticks; track t.v) {
        <span class="absolute -top-1 h-[18px] w-px bg-ink/40" [style.left.%]="(100 * t.v) / max" aria-hidden="true"></span>
      }
    </div>
    <div class="relative mt-1.5 h-4 text-[11px] text-dim mono" aria-hidden="true">
      @for (t of ticks; track t.v) {
        <span class="absolute -translate-x-1/2 whitespace-nowrap" [style.left.%]="(100 * t.v) / max">{{ t.label }} {{ t.v }}</span>
      }
    </div>
  `,
})
export class ScoreMeter {
  score = input.required<number>();
  status = input.required<Status>();
  /** Fixed scale (twice the block threshold) so the threshold marks never move; higher scores fill the bar. */
  protected max = 2 * POLITICA.score_bloquear;
  protected ticks = [{ v: POLITICA.score_revisar, label: 'revisar' }, { v: POLITICA.score_bloquear, label: 'bloquear' }];
  protected Math = Math;
}

interface Segmento {
  texto: string;
  tipo?: string;
}

/** Splits the original text (code points) into plain runs and findings, using the normalized->original map. */
export function segmentar(texto: string, spans: Span[], mapa: number[]): Segmento[] {
  const src = Array.from(texto);
  const out: Segmento[] = [];
  let pos = 0;
  for (const s of spans) {
    const a = mapa[s.start];
    const b = mapa[s.end - 1] + 1;
    if (a > pos) out.push({ texto: src.slice(pos, a).join('') });
    out.push({ texto: src.slice(a, b).join(''), tipo: s.tipo });
    pos = b;
  }
  if (pos < src.length) out.push({ texto: src.slice(pos).join('') });
  return out;
}

/** Same masking as the API, but on the original text: line breaks survive (the API answers on one line). */
export const mascarar = (texto: string, spans: Span[], mapa: number[]) =>
  segmentar(texto, spans, mapa)
    .map((s) => (s.tipo ? s.texto.replace(/[^\r\n]/g, '*') : s.texto))
    .join('')
    .trim();

/** The text with each finding highlighted (type tag) or redacted (ink bar). */
@Component({
  selector: 'app-doc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="doc">@for (s of segmentos(); track $index) {@if (!s.tipo) {<span>{{ s.texto }}</span>} @else if (tarjar()) {<span class="redact"><span class="sr-only">[{{ label(s.tipo) }} tarjado]</span><span aria-hidden="true">{{ s.texto }}</span></span>} @else {<mark class="pii">{{ s.texto }}<span class="pii-tag">{{ label(s.tipo) }}</span></mark>}}</p>`,
})
export class DocView {
  texto = input.required<string>();
  spans = input.required<Span[]>();
  mapa = input.required<number[]>();
  tarjar = input(false);
  protected segmentos = computed(() => segmentar(this.texto(), this.spans(), this.mapa()));
  protected label = tipoLabel;
}

/** Counts per finding type, most frequent first. */
export function contarTipos(tipos: string[]): { tipo: string; label: string; n: number }[] {
  const n = new Map<string, number>();
  for (const t of tipos) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].map(([tipo, c]) => ({ tipo, label: tipoLabel(tipo), n: c })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

/** Saves a file generated in memory (Blob URL): nothing is uploaded. */
export function baixar(nome: string, conteudo: string, mime: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const carimbo = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
