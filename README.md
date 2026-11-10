# SafeDoc-DF

Detector de **dados pessoais em pedidos de acesso à informação** (LAI/LGPD): encontra CPF, CNPJ, RG, telefone, e-mail, CEP, placa, datas, matrículas, processos e nomes, classifica o risco (publicar, revisar ou bloquear) e devolve o texto anonimizado.
Criado por [Gustavo Martins Gripaldi](https://g2portfolio.grovicdata.com/) e Mayron Oliveira Malaquias para o 1º Hackathon em Controle Social: Desafio Participa DF (CGDF), categoria Acesso à Informação.

**Ao vivo:** https://g2martins.github.io/SafeDoc-DF/ · **No portfólio:** https://g2portfolio.grovicdata.com/projetos/safedoc-df/

> Demo estática: a análise roda no navegador. Texto colado e CSV enviado nunca saem do dispositivo (não existe servidor, não há analytics, fontes e scripts são do próprio site e uma CSP `connect-src 'self'` impede chamadas a outros domínios).

## O que tem

- **Análise de texto ao vivo**: cole um pedido (ou escolha um dos exemplos sintéticos) e veja, enquanto digita, o status, o score com os limiares, os dados marcados no próprio texto (modo destacar ou tarjar), a tabela de ocorrências com o motivo de cada uma e o texto anonimizado para copiar ou baixar (TXT ou o JSON exato de `POST /validate/text`).
- **Análise em lote**: arraste um CSV ou carregue as amostras do desafio com um clique. O arquivo é lido pelo navegador; o painel mostra pedidos com dados pessoais, distribuição de risco, ocorrências por tipo, tabela por pedido com filtro e detalhe, e baixa o CSV anonimizado (com `status`, `score` e `dados_pessoais`) ou o JSON de `POST /validate/csv`.
- **Avaliação contra rótulos**: se o CSV tem a coluna `y_true`, a demo calcula precisão, recall, F1 e a matriz de confusão (positivo previsto = REVISAR ou BLOQUEAR). Na amostra rotulada: precisão 64,6%, recall 81,6%, F1 72,1%.
- **Como funciona**: as cinco etapas do motor, as 20 regras (tipo, peso, prioridade, validação), a escala de risco, o contexto da LAI e da LGPD e os limites conhecidos (falsos positivos e negativos de uma abordagem por regex).

## O motor no navegador espelha a API

`FrontEnd/src/app/engine/detector.ts` é uma tradução linha a linha de `BackEnd/src/core/detector.py` (com `models/validators.py` e os limiares de `core/config.py`): mesmas regex, validadores (dígito verificador de CPF/CNPJ, DDD, palavras de contexto), desempate por prioridade/peso/tamanho, pontuação e anonimização. O resultado tem o mesmo formato da API, com as chaves na mesma ordem.

- **Paridade testada**: `npm run parity` roda o motor TypeScript nas 198 linhas das duas amostras e em 66 casos de borda e compara, caractere por caractere, com a saída do código Python real (gerada por `scripts/parity_expected.py`, que lê os CSVs com pandas como o endpoint faz). Resultado atual: 264/264 idênticos. O teste também foi validado com mutações (trocar `\b`, `\s` ou os índices por code point faz ele falhar).
- **Diferenças de regex tratadas**: `\b` e `\w` do Python são Unicode ("nº123" não tem fronteira entre º e 1), `\s` do Python é `str.isspace()`, e o Python indexa por code point enquanto o JavaScript usa UTF-16. O port emula cada um.
- **Uma otimização sem mudar resultado**: a regex de nome completo do Python tem backtracking exponencial numa palavra longa sem espaço (cerca de 50 ms com 44 letras, segundos acima de 50, no Python também). No port cada palavra termina com `(?![letra])`, o que só corta caminhos que falhariam ou repetiriam um estado já testado; os casos de paridade cobrem isso.
- **Diferenças de interface (não do motor)**: o texto anonimizado mostrado e o CSV baixado mantêm as quebras de linha do original (a API devolve o texto normalizado em uma linha, e o JSON baixado é exatamente esse). O leitor de CSV aceita `;` e tabulação, tenta UTF-8 e cai para Windows-1252, e se não houver coluna com nome aceito pela API (`descricao`, `texto mascarado`, `detalhe`, `mensagem`, `conteudo`) escolhe a de textos mais longos, avisando que a API recusaria o arquivo. Célula vazia é analisada como vazia (o pandas da API analisaria `"nan"`; o status é o mesmo).

## Stack

**Demo (FrontEnd/)**: Angular 21 standalone, zoneless e signals, SSG (`outputMode: "static"`) com hidratação incremental e event replay · Tailwind CSS v4 · TypeScript 5.9 · Geist e Geist Mono self-hosted · scripts em Node 22 com TypeScript nativo · Playwright (Python) para a imagem social. Linguagem visual baseada no design system Valerium da Grovic Data, nas cores do logo original.

**API original (BackEnd/)**: Python, FastAPI, pandas, Uvicorn. Endpoints `POST /validate/text` (`{"texto": "..."}`), `POST /validate/csv` (multipart) e `GET /health`. Continua no repositório e roda como antes.

## Rodar

Demo:

```bash
cd FrontEnd
npm install
npm start            # http://localhost:4200/SafeDoc-DF/
npm run parity       # paridade TypeScript x Python
npm run build:pages  # build + checagem + paridade + publica em ../docs
```

Regerar a saída de referência da API (só quando as regras do Python mudarem; precisa de pandas):

```bash
cd FrontEnd
python -I scripts/parity_expected.py
```

API:

```bash
cd BackEnd
python -m venv venv
venv\Scripts\activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000   # Swagger em http://127.0.0.1:8000/docs
```

## Estrutura

```
BackEnd/                     API FastAPI original (detector.py, validators.py, config.py) + data/input (amostras)
FrontEnd/src/app/engine/     detector.ts (port do detector.py) · csv.ts (leitura e escrita de CSV)
FrontEnd/src/app/pages/      home · analyzer (análise de texto) · batch (/lote/) · how (/como-funciona/) · not-found
FrontEnd/src/app/shared/     status, score, texto marcado, SEO, ícones, trailing slash
FrontEnd/src/app/data/       site.ts: constantes, rótulos das regras, exemplos, amostras
FrontEnd/src/app/state.ts    estado da análise de texto e do lote (signals, só em memória)
FrontEnd/scripts/            seo.ts, check.ts, parity.ts, parity_expected.py, pages.ts, og.py
docs/                        saída do build (GitHub Pages), não editar à mão
```

## Deploy

GitHub Pages servindo `main:/docs` com base `/SafeDoc-DF/`. `npm run build:pages` gera o build (com sitemap, robots, amostras e fontes), roda `npm run check` (title e description de até 160 caracteres, canonical, JSON-LD `WebSite` + `WebApplication` sem oferta nem avaliação, links internos terminando em `/`, nenhum recurso de outro domínio, nenhum travessão longo), roda a paridade e copia para `docs/` com `.nojekyll` e um `404.html` com `noindex`.

## Privacidade

- O texto e o CSV são processados em memória, no navegador, e somem ao fechar a aba. Downloads são gerados localmente (Blob).
- Sem analytics, sem fontes ou scripts de terceiros. A CSP do `index.html` limita `connect-src` ao próprio site (as amostras são arquivos estáticos dele).
- CSV baixado: células que começam com `=`, `+`, `-` ou `@` ganham um `'` na frente para não virar fórmula no Excel.
- Os exemplos e as amostras usam dados sintéticos.

## Histórico

A versão do hackathon (Angular 20 chamando a API) está na tag `v1-original`. Vídeo da versão full stack: https://youtu.be/6ouxHb6CS3Q

Projeto desenvolvido conforme o Edital nº 10/2025 da CGDF; direitos de propriedade intelectual conforme previsto no edital. Projeto independente, sem vínculo oficial com a CGDF.
