# CLAUDE.md, SafeDoc-DF

> **Spec viva.** Porta de entrada lida pelo agente em toda sessão. Não duplica o [README.md](README.md), **aponta** pra ele. Atualize quando uma regra, comando, módulo ou hurdle mudar.
>
> **Última revisão:** 2026-11-10
> **Detalhes de features, paridade, rodar e deploy:** [README.md](README.md)

---

## 1. O que é

Detector de **dados pessoais em pedidos de acesso à informação** (LAI/LGPD) feito para o 1º Hackathon em Controle Social: Desafio Participa DF (CGDF), por Gustavo Martins Gripaldi e Mayron Oliveira Malaquias. Peça de portfólio de Gustavo, linkada em https://g2portfolio.grovicdata.com/projetos/safedoc-df/. Ao vivo: https://g2martins.github.io/SafeDoc-DF/ (**demo estática: a análise roda no navegador, nada é enviado**). O repositório guarda as duas versões: a API FastAPI original em `BackEnd/` (documenta o full stack, não mexer) e o site em `FrontEnd/`, que traz o mesmo motor portado para TypeScript. A versão anterior do front (Angular 20 chamando a API) está na tag `v1-original`.

## 2. Stack + Comandos

Angular 21.2 standalone + zoneless + signals, SSG (`outputMode: "static"`), `provideClientHydration(withEventReplay(), withIncrementalHydration())`, Tailwind v4 (`@tailwindcss/postcss`), TS ~5.9, Node 22 (scripts `.ts` nativos). GitHub Pages em `main:/docs` (raiz do repo), `baseHref` `/SafeDoc-DF/`. API: Python 3.11, FastAPI, pandas.

```bash
cd FrontEnd
npm start            # seo + ng serve (http://localhost:4200/SafeDoc-DF/)
npm run parity       # motor TS x saída real do Python (scripts/parity/expected.json); tem que dar N/N idênticos
npm run build        # seo (sitemap, robots, amostras, fontes) + ng build com prerender
npm run check        # smoke pós-build: SEO por página, barra no fim dos links, nada de outro domínio, zero travessão longo
npm run build:pages  # build + check + parity + copia para ../docs (.nojekyll, 404.html noindex)
npm run og           # python -I scripts/og.py: OG 1200x630 + ícones PNG via Playwright
python -I scripts/parity_expected.py   # regera expected.json rodando o detector.py real (precisa de pandas)
```

## 3. Mapa de módulos

| Caminho | Responsabilidade |
|---|---|
| `BackEnd/src/core/detector.py`, `models/validators.py`, `core/config.py` | Fonte da verdade das regras. Não editar sem regerar `expected.json` e portar a mudança. |
| `BackEnd/data/input/*.csv` | Amostras do desafio (fonte única; `scripts/seo.ts` copia para `FrontEnd/public/amostras/`). |
| `FrontEnd/src/app/engine/detector.ts` | Port linha a linha do detector (regex, validadores, overlap, score, anonimização) + `mapa` normalizado→original para destacar. Sem imports (Node roda direto). |
| `FrontEnd/src/app/engine/csv.ts` | Leitura RFC 4180 (como `pandas.read_csv`, + `;`/tab) e escrita com BOM e proteção contra fórmula. Sem imports. |
| `FrontEnd/src/app/data/site.ts` | Constantes, rótulos e descrições das regras, exemplos sintéticos, amostras. Sem imports (scripts leem direto). |
| `FrontEnd/src/app/state.ts` | `Analisador` (texto) e `Lote` (CSV): signals, só em memória. |
| `FrontEnd/src/app/pages/` | `home` (hero + links), `analyzer` (análise de texto, hidratada só ao entrar na tela), `batch` (`/lote/`: upload, painel, tabela, downloads, métricas y_true), `how` (`/como-funciona/`), `not-found` (client). |
| `FrontEnd/src/app/shared/` | `ui.ts` (status, score, texto marcado/tarjado, download), `seo.ts`, `icon.ts`, `trailing-slash.ts`. |
| `FrontEnd/scripts/` | `seo.ts`, `check.ts`, `parity.ts` + `parity/` (casos e saída esperada), `parity_expected.py`, `pages.ts`, `og.py` + `og.html`. |
| `docs/` | Saída do build publicada. Nunca editar à mão. |

## 4. Regras SEMPRE-ATIVAS

- **Paridade com a API é contrato:** qualquer mudança em `detector.ts` mantém `npm run parity` 100% idêntico. Mudou regra no Python: porta, regera `expected.json`, adiciona caso em `parity/cases.json`. Diferenças Python x JS (`\b`/`\w` Unicode, `\s` = `str.isspace()`, índices por code point) já são emuladas; não "simplificar" de volta.
- **Privacidade:** texto e CSV nunca saem do navegador. Sem analytics, sem CDN, sem fonte externa; CSP `connect-src 'self'` no `index.html`; `check.ts` falha com script/estilo/preconnect de outro domínio. Downloads via Blob.
- **Faixa de aviso** em toda página: "Projeto de portfólio de Gustavo Martins Gripaldi. Demo estática: a análise roda no seu navegador e nenhum dado é enviado." com link para a página do projeto no portfólio.
- **SSG:** toda rota real é pré-renderizada. APIs do browser só em eventos ou `afterNextRender`. O exemplo inicial é analisado no prerender (HTML já vem marcado).
- **Links internos com barra no fim** (`TrailingSlashSerializer` em `app.config.ts`); links do portfólio também terminam em `/`. `check.ts` trava.
- **Animação só `transform`/`opacity`**, com `prefers-reduced-motion`; o h1/hero (LCP) nunca começa escondido. Fontes Geist pré-carregadas com `font-display: optional` (CLS 0).
- **Design Valerium em papel:** Geist + Geist Mono, eyebrow mono, card "well", ticks, dot grid. Cores só pelos tokens de `:root` (violeta e âmbar do logo original). Status PUBLICAR/REVISAR/BLOQUEAR sempre com ícone + rótulo, cores reservadas.
- **Zero travessão longo (U+2014)** em texto visível; o `check` varre html/js/css/json do build.
- **JSON-LD honesto:** `WebSite` + `WebApplication`, autor = Person do portfólio (`@id` `https://g2portfolio.grovicdata.com/#person`), sem `offers` nem `aggregateRating`.
- **`npm run build:pages` verde** antes de publicar. `docs/` é build.

## 5. Segurança

- Entrada hostil por padrão: texto do usuário só por interpolação do Angular (escapado), nada de `innerHTML`. JSON-LD escapa `<`.
- CSV gerado: células começando com `=`, `+`, `-`, `@`, tab ou CR ganham `'` (injeção de fórmula). Upload limitado a 5 MB; texto colado a 20 000 caracteres (`MAX_TEXT_LENGTH` do `config.py`).
- A regex de nome do Python tem backtracking exponencial em palavra longa; o port usa `(?![l])` no fim de cada palavra (mesmo resultado, custo linear). Não remover: sem ela uma palavra de 60 letras trava a aba.
- Sem segredos no projeto. O `.gitignore` da raiz cobre `node_modules`, `dist`, `.angular`, `venv`, `.env*`, `.shots/` e os arquivos gerados em `public/amostras` e `public/fonts`.

## 6. Common Hurdles

- **Node 22 `cpSync` sai com 127 em silêncio** no caminho com "Programação": usar `cp` de `fs/promises` (ver `scripts/pages.ts`).
- **EBUSY** ao recriar `docs/` se um shell ou servidor estiver com cwd dentro dela.
- **Python com caminho não-ASCII via argumento** chega corrompido: rodar de dentro de `FrontEnd/` com caminho relativo e `python -I`.
- **pip falha com SSL (certificado do Kaspersky):** `pip install --use-feature=truststore pandas==2.2.0` usa o repositório de certificados do Windows. venv em pasta temporária, fora do repo.
- **Kaspersky e Lighthouse:** injeta `http://gc.kis...kaspersky-labs.com/.../main.js` e serve o HTML sem gzip, então boas práticas cai para 82 (só `is-on-https`, por causa do script injetado) e o LCP sobe. Medir no Chromium do Playwright com `--remote-debugging-port=445x` e `npx lighthouse@12 <url> --port=445x --blocked-url-patterns="*kaspersky-labs.com*"`, servindo `docs/` com gzip sob `/SafeDoc-DF/` e devolvendo 404 fora da base (senão o `robots.txt` da raiz vira HTML e o SEO cai).
- **Tailwind v4 tem utilitário `grow`** (flex-grow): a animação de barra se chama `anim-grow` para não esticar as fatias do gráfico.
- **Fonte com hash não dá para pré-carregar:** as Geist latinas são copiadas por `seo.ts` para `public/fonts/` com nome fixo e declaradas em `styles.css` com URL absoluta `/SafeDoc-DF/fonts/...`.
- **Texto marcado (`app-doc`) usa `white-space: pre-wrap`:** o template fica numa linha só, sem espaço entre blocos `@if`/`@for`, senão aparecem espaços extras.
- **Hidratação incremental do analisador:** `@defer (on immediate; hydrate on viewport)` só separa o chunk se o componente estiver em arquivo próprio (`pages/analyzer.ts`). O `@placeholder` (só aparece em navegação client-side) mantém o `id="analisar"` para a âncora. Isso derrubou o TBT mobile da home de ~270 ms para ~60 ms.
- **Testes Playwright:** `get_by_role("button", name="Ver")` casa com o input de arquivo (o rótulo tem "houver"): usar `exact=True`. No Windows a área de transferência devolve CRLF.
