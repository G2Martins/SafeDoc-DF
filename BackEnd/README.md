# SafeDoc-DF - Backend

## 📋 Sobre o Projeto

O **SafeDoc-DF** é uma solução desenvolvida para o **1º Hackathon em Controle Social: Desafio Participa DF** (Categoria: Acesso à Informação), promovido pela Controladoria-Geral do Distrito Federal (CGDF).

### Objetivo
Identificar automaticamente dados pessoais em pedidos de acesso à informação marcados como públicos, garantindo conformidade com a LGPD e protegendo informações sensíveis dos cidadãos.

### Dados Pessoais Detectados
- **Nome completo** (com validação por contexto)
- **CPF** (com validação por dígito verificador; aceita também CPF inválido **quando há contexto “CPF”**)
- **CNPJ** (validação por dígito verificador)
- **RG** (heurístico + contexto)
- **Telefone** (fixo e celular, validação **estrita** com DDD e regras anti-falso-positivo)
- **E-mail**
- **Processos** (CNJ e SEI – incluindo variações comuns em órgãos públicos)
- **CEP** (apenas quando há contexto de endereço)
- **Placa de veículo** (soft, com contexto)

> Observação: alguns itens são tratados como **soft** para reduzir falsos positivos (ex.: data, placa, CEP sem contexto, RG heurístico e nomes sem contexto).

---

## 🏗️ Arquitetura do Projeto

```md
SafeDoc-DF/
├── BackEnd/
│   ├── src/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes.py       # Endpoints da API
│   │   │   └── schemas.py      # Modelos Pydantic
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py       # Configurações (política/limiares)
│   │   │   └── detector.py     # Motor de detecção PII
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── validators.py   # Validadores CPF/CNPJ/Telefone
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── metrics.py      # Cálculo de métricas
│   │   └── main.py             # Aplicação principal
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_detector.py
│   │   └── test_validators.py
│   ├── data/
│   │   ├── input/              # Dados de entrada CGDF
│   │   └── output/             # Resultados processados
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
└── FrontEnd/
```

---

## 🚀 Tecnologias Utilizadas

### Framework e Bibliotecas
- **Python 3.10+** - Linguagem de programação
- **FastAPI 0.104+** - Framework web assíncrono de alta performance
- **Uvicorn** - Servidor ASGI
- **Pydantic** - Validação de dados e schemas

### Detecção de PII
- **Regex (re)** - Expressões regulares otimizadas para padrões brasileiros
- **Normalização Unicode (unicodedata)** - Normalização do texto para busca contextual
- **Python-multipart** - Upload de arquivos

### Testes e Qualidade
- **Pytest** - Framework de testes
- **Coverage** - Cobertura de código

---

## 📦 Pré-requisitos

- Python 3.10 ou superior
- pip (gerenciador de pacotes Python)
- Virtualenv (recomendado)

---

## ⚙️ Instalação e Configuração

### 1. Clone o Repositório
```bash
git clone <URL_DO_REPOSITORIO>
cd SafeDoc-DF/BackEnd
```

### 2. Crie e Ative o Ambiente Virtual
```bash
# Linux/macOS
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

### 3. Instale as Dependências
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Variáveis de Ambiente
```bash
cp .env.example .env
# Edite o arquivo .env conforme necessário
```

---

## 🔧 Execução

### Modo Desenvolvimento
```bash
uvicorn src.main:app --reload --port 8000
```

### Modo Produção
```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

```
API disponível em: http://127.0.0.1:8000/
Documentação interativa: http://127.0.0.1:8000/docs
```

---

## 🧠 Como funciona a lógica do detector (PII)

O motor de detecção em `src/core/detector.py` é um **detector híbrido**:
- **Regex** para localizar candidatos (padrões como CPF, e-mail, telefone, processos).
- **Validação** (quando aplicável) para confirmar formato/regras (ex.: dígitos verificadores).
- **Contexto** (palavras-chave próximas) para aumentar confiança em itens “soft” e reduzir falso positivo.
- **Pontuação (score)** + **política** para decidir a ação final: `PUBLICAR`, `REVISAR` ou `BLOQUEAR`.

### 1) Normalização do texto
O detector trabalha com duas versões do texto:
- **`raw_text`**: texto “limpo” preservando caracteres originais (acentos/case).  
  Usado para localizar spans e gerar anonimização.
- **`search_text`**: texto normalizado para busca contextual:
  - remove diacríticos (acentos),
  - aplica `casefold`,
  - compacta espaços.
  Usado para encontrar palavras-chave próximas ao match.

### 2) Regras (Regra) e seus parâmetros
Cada padrão é definido como uma **Regra** com os campos:

- `nome`: identificador do tipo (ex.: `"cpf"`, `"telefone"`, `"nome_pessoa"`).
- `padrao`: regex compilada (case-insensitive).
- `tipo`:  
  - **hard**: identificadores fortes (CPF/CNPJ/email/telefone/processos)  
  - **soft**: itens contextuais (CEP, placa, data, RG, nome — dependem de contexto)
- `peso`: quanto a regra contribui para o score.
- `prioridade`: resolve conflitos de overlap (menor = ganha).  
  Exemplo recomendado: CPF/CNPJ/Email (1) > Telefone (2) > Processos (3) > Soft (4).
- `validator` (opcional): função que decide se o match é válido e pode:
  - rejeitar candidatos (reduz falso positivo),
  - normalizar valor,
  - atribuir motivo (ex.: `"cpf_invalido_com_contexto"`).

### 3) Varredura (scan) por regras
Para cada regra:
1. Faz `finditer` no `raw_text`.
2. Se existe `validator`, valida/normaliza.
3. Se **não passou** no validador, descarta (exceto casos como CPF inválido com contexto, que pode ser aceito).
4. Se a regra for **soft**, aplica **boost por contexto**:
   - com keywords de risco próximas → aumenta score
   - sem keywords → derruba para score mínimo (evita marcar IDs aleatórios como CEP, por exemplo)

### 4) Estratégias anti-falso-positivo (principais)
O projeto implementa defesas importantes para dados governamentais, onde muitos números “parecem” dados pessoais:

- **CEP contextual**: só considera CEP se houver contexto de endereço (“rua”, “bairro”, “endereço”, “cep”, etc.).
- **Processo SEI genérico**: inclui regex para formatos comuns que antes geravam colisão com CEP.
- **Telefone estrito**:
  - exige DDD,
  - 11 dígitos exige `9` (celular),
  - rejeita em contexto negativo (“nire”, “protocolo”, “processo”, “sei”, etc.)
- **CPF inválido com contexto**:
  - CPF matematicamente inválido não é automaticamente descartado
  - se houver “CPF” próximo, ainda é considerado sensível (erro humano em bases reais é comum)
- **Nome de pessoa por contexto**:
  - só detecta nomes (2–5 palavras capitalizadas) se existir contexto de pessoa (“Nome:”, “Requerente:”, “Sr(a).” etc.)
  - rejeita se há contexto institucional (“Ministério”, “Secretaria”, “Governo”, etc.)
  - possui allowlist para termos comuns que não devem ser tarjados

### 5) Resolução de overlaps (conflitos)
É comum um match “caber dentro” de outro (ex.: 8 dígitos dentro de um processo).  
O detector resolve overlaps com a ordem:

1. **prioridade** (menor ganha)
2. **maior peso aplicado**
3. **maior comprimento**

Isso evita casos clássicos como:
- detectar um “CEP” dentro de um número de processo.

### 6) Score total e decisão final (Política)
Depois de limpar overlaps, o detector soma os pesos:

`score_total = Σ peso_aplicado(match)`

A decisão final usa a política (`PoliticaRisco`) definida em `src/core/config.py`:

- `score_bloquear`: acima disso → `BLOQUEAR`
- `score_revisar`: acima disso → `REVISAR`
- abaixo → `PUBLICAR`

> A política permite calibrar sensibilidade: mais rigor (mais bloqueios) ou mais conservador (mais revisões).

### 7) Anonimização do texto
Além do relatório de matches, o detector retorna `texto_anonimizado`:
- o trecho detectado é substituído por `*` preservando o tamanho original
- isso permite publicar o conteúdo sem expor o dado sensível

---

## ⚙️ Parâmetros do detector (o que ajustar para “mais completo”)

Você controla o comportamento do detector principalmente por:

### A) Política de risco (`PoliticaRisco`)
Em `src/core/config.py`:
- `score_bloquear`: aumenta/diminui o rigor de bloqueio
- `score_revisar`: controla quando enviar para revisão
- `score_sensivel_estrito`: peso base para itens críticos (CPF/CNPJ)

### B) Regras (`REGRAS`)
No `detector.py`:
- `peso` por tipo (ex.: aumentar peso de `telefone` se for crítico)
- `prioridade` (para resolver overlaps)
- regex (para cobrir variações reais)
- `validator` (para reduzir falso positivo e aceitar casos realistas)

### C) Palavras-chave de contexto
- `PALAVRAS_CHAVE_RISCO`: aumenta score de itens soft quando perto do match
- `KW_NOME_PESSOA`: aumenta recall de nomes (mas cuidado com FP)
- `KW_ORGAO_ENTIDADE` e `ALLOWLIST_PUBLICO_COMUM`: reduzem FP em nomes institucionais

---

## 🧪 Testes
Os testes em `tests/` validam:
- validadores (CPF/CNPJ/telefone)
- casos de colisão (processo vs CEP)
- casos reais (CPF inválido com “CPF:”)
- nomes com contexto de pessoa vs nomes institucionais

---

## 🤖 Declaração de Uso de IA (Item 13.9 do Edital)

Em conformidade com o item 13.9 do Edital nº 10/2025, declaramos que:

1. **No Código Fonte:** O núcleo da solução (**SafeDoc-DF**) baseia-se em algoritmos determinísticos, Expressões Regulares (Regex) otimizadas para o contexto brasileiro e validação lógica (Dígitos Verificadores). Não há uso de modelos de IA Generativa (LLMs) no processamento em tempo real dos dados, garantindo previsibilidade e baixo custo computacional.
2. **No Desenvolvimento:** Ferramentas de IA Generativa (como ChatGPT/Gemini) foram utilizadas como auxiliares para:
   - Geração de massa de dados fictícia para testes unitários.
   - Refatoração de código e otimização de docstrings.
   - Estruturação da documentação técnica.

---

## 🛡️ Privacidade e Segurança (Design Privacy)

O SafeDoc-DF foi projetado seguindo os princípios de *Privacy by Design*:

- **Processamento Local/Efêmero:** A API processa os arquivos em memória e devolve o resultado. Nenhum dado do cidadão (CPF, Telefone, etc.) é salvo em banco de dados persistente ou enviado para APIs de terceiros.
- **Anonimização:** O sistema oferece a funcionalidade de retornar o texto mascarado (ex: `***.456.789-**`), garantindo que a informação possa ser publicada no SEI/DODF sem expor o titular.

---

## 👥 Equipe

Projeto desenvolvido por:

- **[Mayron Oliveira Malaquias]** - *[BackEnd Developer]* - [Linkedln](https://www.linkedin.com/in/mayronn/)
- **[Gustavo Martins Gripaldi]** - *[FrontEnd Developer / Data Engineering]* - [Linkedln](https://www.linkedin.com/in/g2martins/)

---

*Desafio Participa DF - 1º Hackathon em Controle Social da CGDF.*
