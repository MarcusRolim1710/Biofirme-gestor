# Biofirme Gestor

Sistema de gestão Biofirme — cadastro de funcionários, documentos e dashboard.

> **Deploy automático na Vercel** a cada push em `main`.
> Projeto: `Biofirme-gestor`

## Stack

- Frontend: HTML / CSS / JavaScript (vanilla) + GSAP
- API: Vercel Functions em `api/` (Node.js)
- Banco: **Neon Postgres** (`@neondatabase/serverless`)
- Storage: **Neon Object Storage** (S3 compatível, bucket privado)
- Autenticação própria: bcrypt + JWT em cookie `httpOnly`
- Compressão: imagens (WebP/JPEG) e PDFs (pdf.js + jsPDF no cliente; sharp + pdf-lib na CLI)

## Como rodar localmente

```bash
npm install
# copie .env.example para .env.local e preencha os valores (ver abaixo)
npm run dev
# abra http://localhost:3000
```

O servidor local serve os arquivos estáticos e as rotas `/api/*`.

## Variáveis de ambiente

Configure em `.env.local` para desenvolvimento e em **Vercel → Project Settings → Environment Variables** para produção:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string pooled do Neon |
| `AUTH_SECRET` | Segredo do JWT (mín. 32 caracteres) |
| `AWS_ENDPOINT_URL_S3` | Endpoint S3 do Neon |
| `AWS_ACCESS_KEY_ID` | Token id da credencial de storage |
| `AWS_SECRET_ACCESS_KEY` | Secret da credencial de storage |
| `AWS_REGION` | Região do bucket (ex.: `us-east-1`) |
| `STORAGE_BUCKET` | Nome do bucket (ex.: `biofirme`) |
| `ALLOWED_ORIGINS` | Origens do CORS, separadas por vírgula (opcional) |
| `SEED_PASSWORD_MARCUS` / `SEED_PASSWORD_GESTOR` | Senhas usadas por `npm run db:seed` |

⚠️ **Nunca commite `.env.local`** — ele está no `.gitignore`. Use apenas o `.env.example` como modelo.

## Usuários iniciais

Criados com `npm run db:seed` (senhas definidas em `.env.local`, nunca versionadas):

| Usuário | Perfil |
|---------|--------|
| `marcus.rolim` | admin |
| `gestor.biofirme` | admin |

## Setup do banco e storage

```bash
npm run db:migrate      # aplica db/schema.sql no Neon
npm run db:seed         # cria/atualiza os usuários admin
npm run storage:setup   # configura CORS do bucket e testa PUT/GET/DELETE
npm test                # smoke test: tabelas + usuários + storage
```

## Compressão de arquivos

No navegador, todo arquivo é comprimido antes do upload:

- **Imagens:** canvas → WebP (fallback JPEG), máx. 1280px, qualidade 0.72.
- **PDFs:** `pdf.js` + `jsPDF`; se a economia for baixa, o original é mantido.

Para compactar arquivos em lote (por exemplo, antes de importar):

```bash
npm run compress -- .\pasta_de_documentos --out compressed --pdf-mode auto
```

Modos de PDF: `auto` (padrão, lossless → raster se economia < 15%), `lossless`, `raster`.

## Endpoints da API

| Rota | Métodos | Descrição |
|------|---------|-----------|
| `/api/auth?action=login\|logout\|me` | POST/GET | Sessão |
| `/api/employees` | GET/POST/PATCH/DELETE | Funcionários |
| `/api/positions` | GET/POST/PATCH/DELETE | Cargos e salários |
| `/api/documents` | GET/POST/DELETE | Arquivos diversos |
| `/api/uploads` | POST | URL presigned de upload |
| `/api/files?key=...` | GET | Redirect para URL assinada de leitura |
| `/api/health` | GET | Status de DB e storage |

## Estrutura

- `index.html` — login
- `dashboard.html` — painel principal
- `js/api.js` — cliente da API
- `js/compress.js` — compressão client-side
- `api/` — Vercel Functions
- `db/schema.sql` — schema PostgreSQL
- `scripts/` — migração, seed, storage, compressão, smoke test

---

Desenvolvido por Marcus Rolim
