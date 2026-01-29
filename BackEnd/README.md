# SafeDoc-DF - Backend

## 📋 Sobre o Projeto

O **SafeDoc-DF** é uma solução desenvolvida para o **1º Hackathon em Controle Social: Desafio Participa DF** (Categoria: Acesso à Informação), promovido pela Controladoria-Geral do Distrito Federal (CGDF).

### Objetivo
Identificar automaticamente dados pessoais em pedidos de acesso à informação marcados como públicos, garantindo conformidade com a LGPD e protegendo informações sensíveis dos cidadãos.

### Dados Pessoais Detectados
- **Nome completo**
- **CPF** (Cadastro de Pessoa Física)
- **RG** (Registro Geral)
- **Telefone** (fixo e celular)
- **E-mail**

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
│   │   │   ├── config.py       # Configurações
│   │   │   └── detector.py     # Motor de detecção PII
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── validators.py   # Validadores CPF/RG
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
│   ├── .env.example
│   └── README.md
└── FrontEnd/
```


---

## 🚀 Tecnologias Utilizadas

### Framework e Bibliotecas
- **Python 3.10+** - Linguagem de programação
- **FastAPI 0.104+** - Framework web assíncrono de alta performance
- **Uvicorn** - Servidor ASGI para produção
- **Pydantic** - Validação de dados e schemas

### Detecção de PII
- **Regex (re)** - Expressões regulares otimizadas para padrões brasileiros
- **Unidecode** - Normalização de texto para detecção de nomes
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
### 🔧 Execução
### Modo Desenvolvimento
```bash
# Na pasta BackEnd
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Modo Produção
```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

```
API disponível em: http://localhost:8000
Documentação interativa: http://localhost:8000/docs
```


