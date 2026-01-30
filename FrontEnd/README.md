<div align="center">

# SafeDoc-DF — FrontEnd  
**Interface Web (Angular + Tailwind) para análise de dados pessoais em pedidos de acesso à informação**

<br>

<p>
  <strong><h3>Tecnologias Utilizadas</h3></strong>
  <img src="https://img.shields.io/badge/Frontend-Angular_20-EA1EF3?style=for-the-badge&logo=angular&logoColor=white" alt="Angular">
  &nbsp;&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Styling-Tailwind_CSS_3-EA1EF3?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  <br><br>
  <img src="https://img.shields.io/badge/Language-TypeScript-8C0590?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  &nbsp;&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/HTTP-RxJS-8C0590?style=for-the-badge&logo=reactivex&logoColor=white" alt="RxJS">
  <br><br>
  <img src="https://img.shields.io/badge/Icons-Font_Awesome-5B0772?style=for-the-badge&logo=fontawesome&logoColor=white" alt="Font Awesome">
  &nbsp;&nbsp;&nbsp;
  <img src="https://img.shields.io/badge/Tooling-Angular_CLI-5B0772?style=for-the-badge&logo=angular&logoColor=white" alt="Angular CLI">
</p>

</div>

---

## 📖 Sobre esta camada (FrontEnd)

Este diretório contém a **interface web** do **SafeDoc-DF**, construída em **Angular (standalone)** e estilizada com **Tailwind CSS**.

A aplicação oferece:

- **Análise rápida de texto**: o usuário cola um texto e o sistema retorna **status**, **score**, **texto anonimizado** e **lista de dados sensíveis detectados**.
- **Análise em lote (CSV)**: o usuário faz upload de um CSV e recebe um relatório com as primeiras linhas, incluindo **texto anonimizado** e **classificação por risco**.
- **Botões de download** (opcional, caso você tenha aplicado a melhoria): exporta resultado em **TXT/JSON** (texto) e **CSV/JSON** (lote).

---

## 🧩 Como o FrontEnd conversa com o Backend

O front consome a API do backend (FastAPI) em:

- `POST /validate/text` — envia `{ texto: "..." }`
- `POST /validate/csv` — envia `multipart/form-data` com o arquivo em `file`

Configuração atual em `src/app/services/api.service.ts`:

```ts
private baseUrl = 'http://localhost:8000';
```

---

## ✅ Pré-requisitos

- **Node.js 18+**
- **npm** (ou yarn/pnpm)
- Backend rodando (recomendado) em `http://localhost:8000`

---

## 🚀 Rodar localmente

Dentro da pasta `FrontEnd`:

```bash
cd frontend
npm install
ng serve
```

Acesse:

- FrontEnd: `http://localhost:4200`

---

## 🔧 Ajuste de URL do Backend (API)

Se seu backend estiver em outra URL/porta, altere:

`src/app/services/api.service.ts`

```ts
private baseUrl = 'http://localhost:8000';
```

Exemplos:

- Backend local em outra porta: `http://localhost:8080`
- Backend em VM/EC2: `http://SEU_IP:8000`
- Backend com domínio/HTTPS: `https://api.seudominio.com`

---

## 🌐 CORS (importante)

Se o backend estiver em outra origem (host/porta), o **FastAPI** deve permitir CORS para `http://localhost:4200`.

No backend, habilite CORS (exemplo):

- Permitir origem `http://localhost:4200`
- Permitir métodos `POST`
- Permitir headers comuns

---

## 🗂️ Estrutura do Projeto (FrontEnd)

Principais caminhos:

```
FrontEnd/
├── src/
│   ├── app/
│   │   ├── components/          # Navbar, Footer e componentes de UI
│   │   ├── pages/
│   │   │   └── home/            # Tela principal (texto + CSV)
│   │   ├── services/
│   │   │   └── api.service.ts   # Client HTTP para o backend
│   │   ├── app.routes.ts        # Rotas
│   │   └── app.config.ts        # Configuração do app
│   ├── index.html               # Inclui Font Awesome via CDN
│   └── styles.css / app.css     # Estilos globais (Tailwind)
├── tailwind.config.js
├── angular.json
└── package.json
```

---

## 🧪 Scripts úteis

- `npm start` — servidor de desenvolvimento
- `npm run build` — build de produção

---

## 📦 Build para produção

```bash
npm run build
```

O output vai para a pasta definida pelo Angular (geralmente `dist/`).

---

## 🛠️ Troubleshooting rápido

### 1) “Erro ao conectar com a API”
- Confirme se o backend está rodando em `http://localhost:8000`
- Confirme CORS habilitado
- Confirme que a rota existe: `POST /validate/text` e `POST /validate/csv`

### 2) “CORS policy blocked”
- Habilite CORS no backend para `http://localhost:4200`

### 3) Upload CSV não funciona
- Verifique se o backend espera `file` como nome do campo do form-data
- Confirme `accept=".csv"` e o conteúdo do CSV

---

## 📄 Licença e contexto (Hackathon)

Este FrontEnd faz parte do projeto **SafeDoc-DF**, desenvolvido para o **Hackathon em Controle Social – Participa DF**, na categoria **Acesso à Informação**, visando apoiar a classificação correta de pedidos quando houver **dados pessoais**.

