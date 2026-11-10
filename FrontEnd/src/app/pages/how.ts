import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTHOR, COAUTHOR, REPO_URL, TIPOS } from '../data/site';
import { POLITICA, REGRAS, TEXT_COLUMN_CANDIDATES } from '../engine/detector';
import { Icon } from '../shared/icon';
import { Seo } from '../shared/seo';

const PASSOS = [
  { t: 'Normaliza', d: 'Espaços e quebras de linha viram um espaço só. Uma cópia sem acentos e em minúsculas serve para procurar as palavras de contexto.' },
  { t: 'Varre', d: `${REGRAS.length} expressões regulares procuram CPF, CNPJ, e-mail, telefone, processos, CEP, placa, datas, RG, matrículas, inscrições e nomes.` },
  { t: 'Valida', d: 'Dígito verificador de CPF e CNPJ, DDD e 9 do celular, palavras de contexto obrigatórias para IDs e nomes, termos que anulam um telefone.' },
  { t: 'Desempata', d: 'Se dois achados se sobrepõem, vence a regra de maior prioridade (CPF, CNPJ e e-mail primeiro), depois o maior peso, depois o trecho mais longo.' },
  { t: 'Pontua', d: `Soma os pesos: ${POLITICA.score_bloquear} ou mais é BLOQUEAR, de ${POLITICA.score_revisar} a ${POLITICA.score_bloquear - 1} é REVISAR, abaixo disso PUBLICAR. Cada achado vira asteriscos.` },
];

const LIMITES = [
  { t: 'Regras, não compreensão', d: 'É regex com validação, sem modelo de linguagem. Não entende o sentido da frase: um dado descrito por extenso ("meu número termina em 32") passa.' },
  { t: 'Falsos positivos', d: 'Qualquer número de 11 dígitos vira CPF, mesmo com dígito verificador errado (motivo cpf_suspeito_dv). Depois de um gatilho como "Servidor:", o padrão de nome ignora maiúsculas, então "telefone funcional" ou "cidade de Ceilândia" podem virar nome.' },
  { t: 'Falsos negativos', d: 'Nome sem gatilho antes não é marcado. Um telefone é descartado se "id" aparecer a até 60 caracteres, e "id" está dentro de "cidade" e "pedido". Endereço sem CEP e RG fora do formato também escapam.' },
  { t: 'Contexto por substring', d: 'As palavras de contexto são buscadas como pedaços de texto: "av" casa com "navegar" e "ri" com "Maria". Quase todo texto acaba tendo contexto para as regras contextuais.' },
];

@Component({
  selector: 'app-how',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap pt-12 pb-6 sm:pt-16">
      <p class="eyebrow">Como funciona</p>
      <h1 class="h-display mt-5 max-w-4xl text-[38px] sm:text-[54px]">Regras claras para decidir o que é dado pessoal</h1>
      <p class="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">
        O SafeDoc-DF nasceu no 1º Hackathon em Controle Social da CGDF (Desafio Participa DF, categoria Acesso à Informação):
        achar dados pessoais em pedidos de acesso à informação marcados como públicos, antes de publicar. Esta página explica
        cada etapa do motor e onde ele erra.
      </p>
    </section>

    <section class="wrap py-8" aria-labelledby="pipeline-title">
      <h2 id="pipeline-title" class="sr-only">Etapas</h2>
      <ol class="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        @for (p of passos; track p.t; let i = $index) {
          <li class="card p-5">
            <span class="mono text-[12px] text-brand">0{{ i + 1 }}</span>
            <p class="mt-2 text-[17px] font-medium">{{ p.t }}</p>
            <p class="mt-2 text-[13px] leading-relaxed text-ink-2">{{ p.d }}</p>
          </li>
        }
      </ol>

      <div class="card mt-8 p-5 sm:p-6">
        <p class="text-[13px] text-ink-2">Escala de risco (soma dos pesos)</p>
        <div class="mt-4 flex h-3 gap-[2px]" aria-hidden="true">
          <span class="fill-PUBLICAR rounded-l-[4px]" [style.flex]="politica.score_revisar"></span>
          <span class="fill-REVISAR" [style.flex]="politica.score_bloquear - politica.score_revisar"></span>
          <span class="fill-BLOQUEAR rounded-r-[4px]" style="flex: 8"></span>
        </div>
        <ul class="mt-4 grid gap-2 text-[13px] sm:grid-cols-3">
          @for (f of faixas; track f.status) {
            <li class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-sm" [class]="'fill-' + f.status" aria-hidden="true"></span>
              <span class="mono font-semibold" [class]="f.cor">{{ f.status }}</span>
              <span class="mono text-ink-2">{{ f.faixa }}</span>
            </li>
          }
        </ul>
        <p class="mt-4 text-[13px] text-ink-2">Um CPF sozinho (peso 6) já pede revisão; CPF e e-mail juntos (6 + 5) bloqueiam.</p>
      </div>
    </section>

    <section class="wrap py-10" aria-labelledby="regras-title">
      <p class="eyebrow">As regras</p>
      <h2 id="regras-title" class="h2 mt-3 text-[30px] sm:text-[38px]">{{ regras.length }} regras, na ordem em que rodam</h2>
      <p class="mt-3 max-w-2xl text-[14px] text-ink-2">
        <b class="text-ink">Rígidas</b> contam sempre que o padrão e a validação passam. <b class="text-ink">Contextuais</b> precisam de
        palavras-chave por perto (até 110 caracteres) e algumas só valem com palavras do próprio tipo.
      </p>
      <div class="card mt-7 px-5 py-2 sm:px-6">
        <div class="hidden grid-cols-[11rem_6.5rem_4rem_5.5rem_minmax(0,1fr)] gap-4 border-b border-line py-3 text-[11px] uppercase tracking-[0.08em] text-dim md:grid" aria-hidden="true">
          <span>Dado</span><span>Tipo</span><span class="text-right">Peso</span><span class="text-right">Prioridade</span><span>Como valida</span>
        </div>
        <ul>
          @for (r of regras; track r.nome) {
            <li class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-b border-line/70 py-3.5 text-[13px] last:border-0 md:grid-cols-[11rem_6.5rem_4rem_5.5rem_minmax(0,1fr)] md:items-baseline">
              <span><span class="font-medium">{{ r.label }}</span><span class="mono block text-[11px] text-dim">{{ r.nome }}</span></span>
              <span class="flex flex-wrap items-center justify-end gap-1.5 md:contents">
                <span class="tag">{{ r.tipo }}</span>
                <span class="mono num md:text-right"><span class="text-dim md:hidden">peso </span>{{ r.peso }}</span>
                <span class="mono num md:text-right"><span class="text-dim md:hidden">· prioridade </span>{{ r.prioridade }}</span>
              </span>
              <span class="col-span-full text-ink-2 md:col-span-1">{{ r.regra }}</span>
            </li>
          }
        </ul>
      </div>
    </section>

    <section class="wrap py-10" aria-labelledby="lei-title">
      <p class="eyebrow">Contexto legal</p>
      <h2 id="lei-title" class="h2 mt-3 text-[30px] sm:text-[38px]">Transparência sem expor quem pede</h2>
      <div class="mt-7 grid gap-7 md:grid-cols-2">
        <div class="card p-6">
          <p class="mono text-[12px] text-brand">LAI · Lei 12.527/2011</p>
          <p class="mt-3 text-[14px] leading-relaxed text-ink-2">
            Garante o acesso a informações públicas, e os pedidos e respostas podem ir para a transparência ativa. O art. 31 manda
            tratar informações pessoais com respeito à intimidade, à vida privada, à honra e à imagem. Um pedido "público" que
            traz o CPF ou o telefone de quem pede não deveria ser publicado como está.
          </p>
        </div>
        <div class="card p-6">
          <p class="mono text-[12px] text-brand">LGPD · Lei 13.709/2018</p>
          <p class="mt-3 text-[14px] leading-relaxed text-ink-2">
            O art. 5º, I define dado pessoal como informação relacionada a pessoa natural identificada ou identificável. Por isso
            o motor olha além de CPF e RG: telefone, e-mail, endereço, placa, matrícula e número de processo também identificam alguém.
          </p>
        </div>
      </div>
    </section>

    <section class="wrap py-10" aria-labelledby="limites-title">
      <p class="eyebrow">Limites</p>
      <h2 id="limites-title" class="h2 mt-3 text-[30px] sm:text-[38px]">Onde as regras erram</h2>
      <p class="mt-3 max-w-2xl text-[14px] text-ink-2">
        É uma triagem: ajuda a separar o que precisa de olho humano, não substitui a decisão de publicar. O exemplo
        "Limites da regra" na <a routerLink="/" fragment="analisar" class="text-brand underline underline-offset-2">análise de texto</a> mostra dois desses casos.
      </p>
      <div class="mt-7 grid gap-7 md:grid-cols-2">
        @for (l of limites; track l.t) {
          <div class="card p-6">
            <p class="flex items-center gap-2 text-[16px] font-medium"><app-icon name="alert" [size]="16" class="text-warn-ink" /> {{ l.t }}</p>
            <p class="mt-2 text-[14px] leading-relaxed text-ink-2">{{ l.d }}</p>
          </div>
        }
      </div>
    </section>

    <section class="wrap py-10" aria-labelledby="api-title">
      <div class="grid gap-7 lg:grid-cols-2">
        <div>
          <p class="eyebrow">Mesma lógica da API</p>
          <h2 id="api-title" class="h2 mt-3 text-[30px] sm:text-[38px]">Do FastAPI para o navegador</h2>
          <div class="mt-4 space-y-3 text-[14px] leading-relaxed text-ink-2">
            <p>
              A versão original é full stack: Angular chamando uma API FastAPI com pandas. Esta demo traduziu o
              <span class="mono text-[13px]">detector.py</span> linha a linha para TypeScript: mesmas regex, validadores, pesos,
              desempate e anonimização.
            </p>
            <p>
              Um teste de paridade roda todas as linhas das duas amostras e dezenas de casos de borda nas duas versões e exige
              respostas idênticas, caractere por caractere. As diferenças entre o regex do Python e o do JavaScript
              (<span class="mono text-[13px]">\\b</span> e <span class="mono text-[13px]">\\s</span> com Unicode, posições por code point)
              foram tratadas uma a uma.
            </p>
            <p>
              Uma mudança de desempenho, sem mudar resultado: a regex de nome podia levar segundos numa palavra muito longa
              (backtracking exponencial, no Python também). Na demo ela para no fim de cada palavra.
            </p>
          </div>
        </div>
        <div class="card p-5 sm:p-6">
          <p class="eyebrow">Endpoints da API (repositório)</p>
          <ul class="mono mt-4 space-y-3 text-[13px]">
            <li><b class="text-brand">POST</b> /validate/text <span class="block text-[12px] text-dim">{{ '{' }} "texto": "..." {{ '}' }} → status, score, matches, texto_anonimizado</span></li>
            <li><b class="text-brand">POST</b> /validate/csv <span class="block text-[12px] text-dim">multipart; coluna: {{ candidatos }}</span></li>
            <li><b class="text-brand">GET</b> /health</li>
          </ul>
          <p class="mt-5 text-[13px] text-ink-2">
            O backend continua no repositório, em <span class="mono text-[12px]">BackEnd/</span>, para rodar com
            <span class="mono text-[12px]">uvicorn src.main:app</span>.
          </p>
          <a [href]="repo" class="btn btn-line mt-5"><app-icon name="github" [size]="16" /> Ver o código</a>
          <p class="mt-5 border-t border-dashed border-line pt-4 text-[12px] text-dim">Equipe do hackathon: {{ autor }} e {{ coautor }}.</p>
        </div>
      </div>
    </section>
  `,
})
export class How {
  protected passos = PASSOS;
  protected limites = LIMITES;
  protected politica = POLITICA;
  protected faixas = [
    { status: 'PUBLICAR', faixa: `0 a ${POLITICA.score_revisar - 1}`, cor: 'text-good-ink' },
    { status: 'REVISAR', faixa: `${POLITICA.score_revisar} a ${POLITICA.score_bloquear - 1}`, cor: 'text-warn-ink' },
    { status: 'BLOQUEAR', faixa: `${POLITICA.score_bloquear} ou mais`, cor: 'text-crit-ink' },
  ];
  protected repo = REPO_URL;
  protected autor = AUTHOR;
  protected coautor = COAUTHOR;
  protected candidatos = TEXT_COLUMN_CANDIDATES.join(', ');
  protected regras = REGRAS.map((r) => ({
    nome: r.nome,
    label: TIPOS[r.nome]?.label ?? r.nome,
    regra: TIPOS[r.nome]?.regra ?? '',
    tipo: r.tipo === 'hard' ? 'rígida' : 'contextual',
    prioridade: r.prioridade,
    // Soft rules that do not require context score a minimum without it and get a boost with it.
    peso: r.tipo === 'soft' && !r.exige_contexto ? `${r.peso_min_sem_contexto} a ${Math.max(r.peso, r.peso_min_sem_contexto) + r.boost_contexto}` : String(r.peso),
  }));

  constructor() {
    inject(Seo).set({
      title: 'Como funciona: regras, risco e limites | SafeDoc-DF',
      description: 'As regras do SafeDoc-DF para achar dados pessoais em pedidos LAI, como o score decide entre publicar, revisar e bloquear, e os limites da abordagem.',
      path: '/como-funciona/',
    });
  }
}
