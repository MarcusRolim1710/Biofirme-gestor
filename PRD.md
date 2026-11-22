# PRD - Sistema de Cadastro de Funcionários - Biofirme

**Última atualização:** 22/11/2026 — Migração para Neon Postgres + Neon Object Storage, autenticação própria e compressão de imagens/PDFs.

## 1. Visão Geral
Sistema web para centralizar, armazenar e gerenciar o cadastro de funcionários da Biofirme, substituindo o uso de WhatsApp, documentos .docx e imagens soltas. Objetivo: rastreabilidade, segurança e agilidade na consulta e entrega de dados à contabilidade.

### Arquitetura Atual
- **Frontend:** HTML5 + CSS3 + JavaScript vanilla (sem frameworks)
- **Backend:** Vercel Functions (`api/`) com `@neondatabase/serverless`
- **Banco:** Neon Postgres (PostgreSQL 18), branches `production`
- **Autenticação:** Própria — bcrypt (`bcryptjs`) + JWT assinado em cookie `httpOnly`
- **Storage:** Neon Object Storage (S3 compatível), bucket privado `biofirme`
- **Hospedagem:** Vercel (frontend estático + funções serverless)

> **Nota de segurança:** o projeto migrou do antigo Supabase. A secret key do Supabase que esteve versionada em versões anteriores deste documento deve ser considerada comprometida e revogada. Nenhuma credencial é versionada neste repositório.

## 2. Público-alvo
- **Gestores/RH (admin, gestor, manager):** criam, editam, visualizam, baixam e deletam registros.
- **Contabilidade:** visualiza e baixa fichas completas (via login no sistema).
- **Colaboradores (user):** planejado para o painel individual (Fase 4).

## 3. Proposta de Valor Única
Centralizar toda a documentação do funcionário em um único local, com validação automática de dados, fluxo de aprovação e exportação simplificada para a contabilidade.

## 4. Funcionalidades

### Autenticação e autorização
- Login por `username` ou `email` + senha.
- Senhas hasheadas com bcrypt (custo 12) em `profiles.password_hash`.
- JWT assinado com `AUTH_SECRET`, validade de 8h, armazenado em cookie `httpOnly; SameSite=Lax; Secure` em produção.
- Endpoint `/api/auth?action=me` valida a sessão no servidor no carregamento do dashboard.
- RBAC aplicado nas Vercel Functions (não depende de RLS do banco):
  - `admin`: leitura, criação, edição e exclusão; exclusão de cargos e documentos.
  - `gestor` / `manager`: leitura, criação e edição; `gestor` também remove documentos.
  - `user`: leitura (preparado para o painel do colaborador).
- Resposta de login para usuário inexistente usa hash descartável para evitar timing difference.

### CRUD de funcionários
- Cadastro completo com dados pessoais, endereço, vínculo e status.
- Foto de perfil + 5 anexos: RG frente, RG verso, CPF, comprovante de endereço e CTPS.
- Ficha lateral e modal com galeria de documentos e contador `X/5 docs`.
- Exclusão remove também os objetos do storage referenciados.

### Cargos com salário fixo herdado
- Tabela `positions` (`nome` único, `setor`, `salario_base`, `descricao`).
- `employees.cargo_id` com FK e trigger `sync_salario_from_position()` que copia `salario_base → salario` e sincroniza `cargo`/`setor`.
- Salário no funcionário é somente leitura; fonte única é o cargo.

### Arquivos diversos
- Tabela `employee_documents` (`tipo`: `certificado`, `doc_filho`, `outro`; `titulo`, `url`, `mime`, `tamanho_bytes`).
- Fila `pendingDiversos` para criação e envio imediato em edição.
- Exibidos na ficha e no PDF.

### Validações
- CPF com dígito verificador e máscara `000.000.000-00`.
- RG de 7 a 13 dígitos, máscara `00.000.000-00000`.
- CTPS `000000/000-0`, PIS/PASEP `000.00000.00-0`.
- CEP via ViaCEP; telefone `(00) 00000-0000`.
- Validação no servidor em `api/_lib/validate.js` (whitelist de campos, limites, status/vínculo, tipos e tamanhos).

### Dashboard e exportação
- Métricas em tempo real: Total, Ativos, Pendentes, Aprovados.
- Filtros por nome, CPF, cargo, setor, status e vínculo.
- Exportação da ficha em PDF (`jsPDF`) com foto, anexos, salário do cargo e arquivos diversos.

### Responsividade
- Header com hamburger (`btnMobileNav`) abaixo de 768px.
- Breakpoints 1024/768/640/480; tabela com scroll horizontal; modais com `max-height: 94vh`; touch targets de 44px; `font-size: 16px` em inputs.

### Compressão de arquivos
- Client-side (`js/compress.js`), antes do upload:
  - Imagens: redimensionamento (máx. 1280px) e WebP qualidade 0.72, fallback JPEG.
  - PDFs: `pdf.js` renderiza páginas e `jsPDF` remonta; se a economia for pequena, o original é mantido. PDFs com mais de 30 páginas não são rasterizados.
- CLI para batch (`scripts/compress.js`): `npm run compress -- <arquivo|pasta> [--out compressed] [--pdf-mode auto|lossless|raster]`.
  - Modo `auto`: tenta lossless; se a economia for < 15%, tenta rasterização e escolhe o menor resultado.

### Pendentes
- Painel do colaborador (`/colaborador.html`).
- Reset de senha por gestor (senha temporária + troca no primeiro login).
- Validação de CTPS/PIS por dígito verificador.
- PWA (manifest, service worker, tema escuro) e consentimento LGPD.

## 5. Modelo de Dados (Neon Postgres)

Fonte da verdade: `db/schema.sql` (aplicável com `npm run db:migrate`).

### `positions`
`id bigint PK`, `nome text unique`, `setor text`, `salario_base numeric(12,2)`, `descricao text`, `created_at`, `updated_at`.

### `employees`
`id bigint PK`, dados pessoais (`name`, `cpf unique`, `rg`, `ctps_numero`, `pis_pasep`, `data_nascimento`, `telefone`, `email`), documentos (`foto_url`, `rg_frente_url`, `rg_verso_url`, `cpf_doc_url`, `comprovante_endereco_url`, `ctps_doc_url`), cargo (`cargo`, `cargo_id FK`, `salario`, `salario_moeda`), endereço (`cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`), `status`, `vinculo`, `created_at`, `updated_at`.

- `status`: `Sem dados`, `Pendente de Documentos`, `Aprovado pelo RH`, `Enviado para Contabilidade`, `Ativo`, `Inativo`, `Afastado`, `Férias`.
- `vinculo`: `Ativo`, `Inativo`, `Demitido`, `Afastado`, `Férias`.

### `profiles`
`id uuid PK`, `username unique`, `email unique`, `password_hash`, `role` (`admin|gestor|manager|user`), `employee_id bigint FK UNIQUE ON DELETE SET NULL`, `active boolean`, `created_at`, `updated_at`.

### `employee_documents`
`id bigint PK`, `employee_id bigint FK ON DELETE CASCADE`, `tipo`, `titulo`, `url`, `mime`, `tamanho_bytes`, `created_at`.

### Triggers
- `set_updated_at()` em `employees`, `positions`, `profiles`.
- `sync_salario_from_position()` em `employees` (`BEFORE INSERT OR UPDATE OF cargo_id`).

### Usuários iniciais (seed)
| Usuário | Email | Role |
|---------|-------|------|
| `marcus.rolim` | `marcus.rolim@biofirme.local` | admin |
| `gestor.biofirme` | `gestor.biofirme@biofirme.local` | admin |

Criados/atualizados por `npm run db:seed`, com senhas lidas de `.env.local` (`SEED_PASSWORD_MARCUS`, `SEED_PASSWORD_GESTOR`) — nunca versionadas. Banco iniciado vazio, sem migração de dados antigos.

## 6. Fluxos de Trabalho
1. Gestor cria cargo com salário fixo.
2. Gestor cria funcionário → status *Sem dados*; cargo obrigatório, salário herdado.
3. Gestor/colaborador preenche dados pessoais e endereço e anexa os 5 documentos obrigatórios + arquivos diversos opcionais. Arquivos são comprimidos no navegador antes do upload.
4. Status muda para *Pendente de Documentos* quando faltam anexos.
5. RH revisa a ficha e aprova → *Aprovado pelo RH*.
6. RH exporta PDF → *Enviado para Contabilidade*.

Uploads usam URL presigned de PUT (`/api/uploads`) direto para o bucket; leitura usa redirecionamento assinado (`/api/files?key=...`). O bucket é privado.

## 7. Segurança
- Nenhuma credencial no repositório; `.env.local` e `.env.*` são ignorados (exceto `.env.example`).
- Bucket privado; acesso a arquivos exige sessão autenticada.
- Chaves de objeto validadas (pastas permitidas, sem `..`, sem path absoluto).
- JWT com issuer `biofirme`, expiração em 8h; cookie `httpOnly`.
- Validação de payloads e whitelist de colunas nas APIs (evita SQL injection por nome de campo).
- CORS do bucket restrito às origens em `ALLOWED_ORIGINS` (`npm run storage:setup`).
- Headers de resposta: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

## 8. Integrações Ativas
- **Neon Postgres** via `@neondatabase/serverless` (HTTP, sem pool local).
- **Neon Object Storage** via AWS SDK S3 + presigned URLs.
- **ViaCEP** para endereço.
- **pdf.js + jsPDF** no cliente para compressão de PDFs.

## 9. Stack Técnica (22/11/2026)

| Camada | Tecnologia |
|--------|------------|
| Frontend | HTML5 + CSS3 + JavaScript ES6+ (vanilla), GSAP, jsPDF, pdf.js |
| API | Vercel Functions em `api/` (`auth`, `employees`, `positions`, `documents`, `uploads`, `files`, `health`) |
| Banco | Neon Postgres — `db/schema.sql`, `scripts/migrate.js`, `scripts/seed.js` |
| Autenticação | bcryptjs + jsonwebtoken em cookie `httpOnly` |
| Storage | Neon Object Storage, bucket privado `biofirme`, presigned PUT/GET |
| Compressão | Cliente (canvas WebP + pdf.js/jsPDF) e CLI (sharp + pdf-lib + pdf.js) |
| Desenvolvimento | `npm run dev` (servidor local estático + `/api`) em `http://localhost:3000` |
| Deploy | Vercel (frontend + funciones) |

## 10. Estrutura de Arquivos

```
Biofirme/
├── index.html            # Login
├── dashboard.html        # Dashboard + cadastro completo + cargos + arquivos diversos
├── css/style.css         # Design System + responsividade
├── js/
│   ├── app.js            # Login
│   ├── api.js            # Cliente da API (auth, employees, positions, documents, uploads)
│   ├── dashboard.js      # CRUD, filtros, ficha, PDF
│   ├── compress.js       # Compressão client-side (imagens + PDFs)
│   ├── mask.js           # Máscaras (CPF, RG, CTPS, PIS, CEP, telefone, money)
│   └── animations.js     # GSAP
├── api/
│   ├── _lib/             # http, db, auth, storage, validate
│   ├── auth.js
│   ├── employees.js
│   ├── positions.js
│   ├── documents.js
│   ├── uploads.js
│   ├── files.js
│   └── health.js
├── db/
│   ├── schema.sql
│   └── seed.sql
├── scripts/
│   ├── dev-server.js
│   ├── migrate.js
│   ├── seed.js
│   ├── setup-storage.js
│   ├── compress.js
│   └── smoke-test.js
├── vercel.json
├── .env.example          # Modelo das variáveis (sem valores reais)
└── .env.local            # Segredos locais (gitignore)
```

## 11. Variáveis de Ambiente

Nomes configurados na Vercel (valores reais apenas em `.env.local`, não versionados):

- `DATABASE_URL` — connection string pooled do Neon
- `AUTH_SECRET` — segredo do JWT (mín. 32 caracteres)
- `AWS_ENDPOINT_URL_S3` — endpoint S3 do Neon
- `AWS_ACCESS_KEY_ID` — token id da credencial de storage
- `AWS_SECRET_ACCESS_KEY` — secret da credencial de storage
- `AWS_REGION` — região do bucket
- `STORAGE_BUCKET` — nome do bucket
- `ALLOWED_ORIGINS` — origens permitidas no CORS (opcional)
- `SEED_PASSWORD_MARCUS`, `SEED_PASSWORD_GESTOR` — usados apenas por `npm run db:seed`

## 12. Comandos Úteis

```bash
npm install
npm run db:migrate        # aplica db/schema.sql
npm run db:seed           # cria/atualiza os dois admins
npm run storage:setup     # configura CORS e testa PUT/GET/DELETE
npm run dev               # http://localhost:3000
npm test                  # smoke test (Postgres + storage)
npm run compress -- <arquivo|pasta> --pdf-mode auto
```

## 13. Critérios de Sucesso
- Redução do tempo de busca de documentos em >80%.
- Zero perda de documentos.
- Exportação de ficha em < 1 minuto.
- Nenhuma credencial versionada no repositório.

---

**Documento mantido por:** Equipe Biofirme
**Versão:** 3.0 (Neon Postgres + Object Storage, auth própria, compressão de imagens e PDFs)
