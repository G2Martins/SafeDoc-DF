# 🛡️ SafeDoc-DF  
**Detecção Automática de Dados Pessoais em Pedidos de Acesso à Informação**

<div align="center">

**Hackathon em Controle Social – Desafio Participa DF**  
Categoria: **Acesso à Informação**

</div>

---

## 📖 Sobre o Projeto

O **SafeDoc-DF** é uma solução tecnológica desenvolvida para identificar automaticamente dados pessoais em pedidos de acesso à informação classificados como públicos, apoiando a correta aplicação da Lei de Acesso à Informação (LAI) e da Lei Geral de Proteção de Dados (LGPD).

A solução atua como um motor de análise inteligente, capaz de detectar informações que permitam a identificação direta ou indireta de pessoas naturais, tais como:

- Nome próprio  
- CPF  
- RG  
- Telefone  
- Endereço de e-mail  

Quando esses dados são encontrados, o pedido pode ser reclassificado como **não público**, reduzindo riscos de exposição indevida e fortalecendo a transparência responsável.

---

## 🎯 Alinhamento com o Edital – Categoria Acesso à Informação

Este projeto foi desenvolvido explicitamente para atender aos requisitos do **Edital nº 10/2025 – CGDF**, contemplando:

- Identificação automática de dados pessoais
- Uso exclusivo de dados sintéticos
- Avaliação por Precisão, Recall e F1-Score
- Documentação completa (critério P2)
- Uso documentado de técnicas de Inteligência Artificial

---

## 🧠 Visão Geral da Solução

O SafeDoc-DF utiliza uma arquitetura híbrida, combinando:

- Regras determinísticas (Regex avançado)
- Validações semânticas
- Normalização textual
- Classificação automatizada
- Interface web para análise e visualização

Fluxo simplificado:

Entrada → Normalização → Detecção → Validação → Classificação

---

## 🏗️ Arquitetura do Projeto

```
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
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── footer/
│   │   │   │   ├── navbar/
│   │   │   │   ├── footer/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   ├── assets/
│   │   ├── main.ts
│   │   ├── styles.css
│   │   └── index.html
│   ├── tailwind.config.js
│   └── angular.json
└── README.md
```

---

## ⚙️ Tecnologias Utilizadas

<div align="center">
  <p>
    <strong><h3>Tecnologias Utilizadas</h3></strong>
    <img src="https://img.shields.io/badge/Frontend-Angular_18-EA1EF3?style=for-the-badge&logo=angular&logoColor=white" alt="Angular">
    &nbsp;&nbsp;&nbsp;
    <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-EA1EF3?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
    <br><br>
    <img src="https://img.shields.io/badge/Backend-Python_FastAPI-8C0590?style=for-the-badge&logo=python&logoColor=white" alt="Python">
    <br><br>
    <img src="https://img.shields.io/badge/Server-Uvicorn-5B0772?style=for-the-badge&logo=uvicorn&logoColor=white" alt="Uvicorn">
    &nbsp;&nbsp;&nbsp;
  </p>
</div>

---

## 🚀 Instalação e Execução

### Pré-requisitos
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

API: http://127.0.0.1:8000  
Swagger: http://127.0.0.1:8000/docs

### Frontend

```bash
cd frontend
npm install
ng serve
```

Aplicação: http://localhost:4200

---

## 📥 Entrada e 📤 Saída

**Entrada:**  
Texto livre ou arquivos CSV com pedidos de acesso à informação.

**Saída:**  
- Classificação: Público ou Contém Dados Pessoais  
- Lista de dados sensíveis identificados

---

## 📊 Métricas

- Precisão
- Sensibilidade (Recall)
- F1-Score

As métricas seguem exatamente o modelo de avaliação definido no edital.

---

## 🔐 LGPD e Segurança

- Nenhum dado real é utilizado
- Processamento local
- Código aberto e auditável
- Estrutura preparada para anonimização

---

## 🤖 Uso de Inteligência Artificial

O projeto utiliza automação inteligente baseada em:
- Heurísticas
- Padrões linguísticos
- Normalização textual
- Arquitetura extensível para ML

Não utiliza modelos generativos externos.

---

## 📄 Licença

Projeto desenvolvido conforme o Edital nº 10/2025 – CGDF.  
Direitos de propriedade intelectual conforme previsto no edital.

---

**SafeDoc-DF — Transparência com Responsabilidade**
