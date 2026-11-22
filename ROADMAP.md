# 🗺️ Cronograma & Roadmap de Desenvolvimento — Biofirm

> **Sistema de Cadastro e Gestão de Colaboradores**  
> Documento de rastreabilidade, status de entregas e planejamento de próximas etapas com base no [PRD.md](file:///c:/Biofirme/PRD.md) e requisitos operacionais.  
> **Última atualização:** 22/11/2026 — Migração para Neon Postgres + Neon Object Storage, API serverless, auth própria e compressão de imagens/PDFs.
>
> ⚠️ As fases 1–6 abaixo registram o histórico do projeto no antigo backend Supabase. O estado atual da arquitetura está na **Fase 7** e no [PRD.md](PRD.md). As chaves do Supabase que apareceram em versões antigas devem ser consideradas revogadas.

---

## 📊 Visão Geral do Progresso

```mermaid
gantt
    title Cronograma de Entregas - Biofirm
    dateFormat  YYYY-MM-DD
    section Fase 1: Fundação
    PRD e Modelagem de Dados      :done, des1, 2026-08-20, 2026-08-22
    Design System & Login         :done, des2, 2026-08-22, 2026-08-25
    section Fase 2: Backend & Auth
    Migração para Supabase        :done, des2b, 2026-08-27, 2026-08-27
    Auth nativo + RLS Policies    :done, des2c, 2026-08-27, 2026-08-27
    section Fase 3: Dashboard
    Layout Assimétrico & CRUD     :done, des3, 2026-08-25, 2026-08-27
    Métricas & Filtros em Tempo Real :done, des4, 2026-08-27, 2026-08-27
    Validações (ViaCEP & CPF/RG)  :done, des5, 2026-08-27, 2026-08-27
    Cadastro completo + compressão (foto, CTPS/PIS, 5 anexos) :done, des5b, 2026-08-31, 2026-08-31
    section Fase 4: Documentos & Colaborador
    Upload Storage + compressão (employee-docs 1GB) :done, des6, 2026-08-31, 2026-08-31
    Cargos c/ salário fixo + arquivos diversos :done, des6b, 2026-09-02, 2026-09-02
    Responsividade (hamburger 480/640/768/1024) :done, des6c, 2026-09-02, 2026-09-02
    Painel do Colaborador         :des7, 2026-09-09, 2026-09-14
    section Fase 5: Exportação & Gestão
    Exportação PDF para Contabilidade :done, des8, 2026-09-02, 2026-09-02
    Reset de Senha por Gestor     :des10, 2026-09-26, 2026-09-28
    section Fase 6: PWA & Compliance
    LGPD & Termo de Consentimento :des11, 2026-09-29, 2026-10-02
    PWA (Manifest, SW, Tema Escuro):des12, 2026-10-03, 2026-10-08
```

---

## 📌 Status Detalhado por Fase

| Fase | Descrição | Status | Conclusão |
| :--- | :--- | :---: | :---: |
| **Fase 1** | Fundação, Banco Supabase & Identidade Visual | ✅ **Concluído** | 100% |
| **Fase 2** | Backend Supabase Auth + RLS | ✅ **Concluído** | 100% |
| **Fase 3** | Dashboard, CRUD, Validações & Máscaras + Cadastro completo | ✅ **Concluído (31/08)** | 100% |
| **Fase 4** | Storage + compressão + Cargos c/ salário fixo + Arquivos diversos + Responsividade ✅ / Painel colaborador pendente | 🔄 **Em progresso** | 85% |
| **Fase 5** | Exportação PDF (com salário/diversos) ✅ / Reset senha pendente | 🔄 **Em progresso** | 50% |
| **Fase 6** | PWA & Compliance (LGPD) | 📋 **Planejado** | 0% |
| **Fase 7** | Migração Neon + API serverless + compressão | ✅ **Concluído (22/11)** | 100% |

---

## ✅ Fase 1: Fundação (Concluída - 22/08/2026)

### Entregas
- ✅ PRD completo com requisitos funcionais e não-funcionais
- ✅ Modelagem inicial do banco de dados (Supabase PostgreSQL)
- ✅ Design System: tipografia (Playfair Display + Inter + JetBrains Mono), paleta de cores, componentes base
- ✅ Tela de login com identidade visual Biofirm

### Stack Inicial
- Frontend: HTML5 + CSS3 + JavaScript vanilla
- Backend: Supabase (PostgreSQL)
- Autenticação: Custom (usuário/senha em tabela `users`)

---

## ✅ Fase 2: Backend Supabase Auth + RLS (Concluída - 27/08/2026)

### Entregas
- ✅ **Migração completa para Supabase Auth nativo**
  - Tabela `auth.users` para autenticação
  - Tabela `public.profiles` com FK para auth.users
  - Trigger automático: `on_auth_user_created` cria profile ao registrar usuário
  - Login via `supabase.auth.signInWithPassword()`
  - Sessão persistente via SessionStorage
  
- ✅ **Row Level Security (RLS) completo**
  - Policy de leitura: todos autenticados podem ler employees
  - Policy de escrita: apenas admin/gestor/manager podem INSERT/UPDATE
  - Policy de exclusão: apenas admin pode DELETE
  - Função `current_user_role()` para checar role via `auth.uid()`
  
- ✅ **Migrations versionadas aplicadas**
  - `20260101000000_align_users_employees_structure.sql`: constraints, índices, trigger updated_at
  - `20260101000100_rls_policies.sql`: policies iniciais (descontinuadas)
  - `20260101000200_security_definer_fix.sql`: revoga acesso anon a funções sensíveis
  - `20260101000300_employees_rpc.sql`: função current_user_role
  - `20260101000400_auth_migration.sql`: profiles + trigger + policies RLS finais
  - `20260101000500_fix_profiles_policies.sql`: corrige recursão infinita em policies
  - `20260101000600_add_employee_address_fields.sql`: adiciona colunas de endereço

- ✅ **Remoção do backend Express**
  - Deletado `server.js`
  - Removidas dependências: express, cors, dotenv, bcryptjs, sqlite3
  - Frontend comunica direto com Supabase via `@supabase/supabase-js`

### Stack Final
- Frontend: HTML5 + CSS3 + JavaScript vanilla + Supabase JS SDK
- Backend: Supabase (PostgreSQL + Auth + Edge Functions + RLS)
- Hospedagem: Pronto para Vercel (frontend estático) + Supabase (backend serverless)

---

## ✅ Fase 3: Dashboard, CRUD, Validações & Máscaras (Concluída - 27/08/2026) + Patch Cadastro Completo (31/08/2026) + Patch Cadastro Completo (31/08/2026)

### Entregas
- ✅ **Dashboard principal** (`dashboard.html`)
  - Layout assimétrico com sidebar de detalhes
  - Listagem de funcionários em tabela responsiva
  - Métricas em tempo real: Total, Ativos, Pendentes, Aprovados
  - Filtros por status, vínculo e busca textual (nome, CPF, cargo, setor)
  
- ✅ **CRUD completo de funcionários**
  - Modal de criação/edição com todos os campos (dados pessoais + endereço)
  - Integração com Supabase via `supabaseClient.from('employees')`
  - INSERT, UPDATE, DELETE protegidos por RLS
  - Trigger automático de `updated_at` ao editar
  
- ✅ **Validações em tempo real**
  - **CPF**: validação por dígito verificador, máscara `000.000.000-00`
  - **RG**: validação **7 a 13 dígitos** (`js/mask.js:19`, `js/dashboard.js:418`), máscara `00.000.000-00000` (`dashboard.html:163` maxlength 16) — ex. `2003099021736` → `20.030.990-21736`
  - **CEP**: integração com ViaCEP, busca automática ao sair do campo, preenchimento de logradouro, bairro, cidade, UF
  - **CTPS**: máscara `000000/000-0` (`js/mask.js:66`) + **PIS/PASEP**: `000.00000.00-0` (`js/mask.js:56`)
  - **Telefone**: máscara `(00) 00000-0000`
  - Feedback visual de erros em tempo real
  
- ✅ **Cadastro completo — patch 31/08/2026** (`dashboard.html`, `js/dashboard.js`, `js/compress.js`, `css/style.css`)
  - Foto de perfil circular + preview + upload `storage:employee-docs/foto/*`
  - Campos `ctps_numero` (CTPS) e `pis_pasep` (PIS/PASEP) com máscaras
  - 5 anexos: `RG frente*`, `RG verso*`, `CPF cópia`, `Comprovante endereço`, `CTPS cópia` (`image/*`/`pdf`, 10MB cada) → `rg_frente_url`, `rg_verso_url`, `cpf_doc_url`, `comprovante_endereco_url`, `ctps_doc_url`
  - Compressão `js/compress.js` (canvas WebP 0.72, max 1280px/foto 800px, ~75% redução) para caber no **1GB** Storage
  - Ficha lateral com foto + `X/5 docs` + CTPS/PIS, modal ficha com links docs, tabela com avatar
- ✅ **Correções e refinamentos**
  - Máscara de RG ajustada para **13 dígitos** (antes 10) — `2003099021736` → `20.030.990-21736` (`maxlength 16`)
  - Constraints CHECK `status` (`Enviado para Contabilidade`, `Inativo`) e `vinculo` (`Inativo`) corrigidos via `add_cadastro_completo_foto_docs`
  - Índices em `pis_pasep`, `ctps_numero` além de cpf/setor/status/name/email/cep

### Usuários de Teste Criados
- **admin.teste@biofirm.local** / `senha123` (role: admin)
- **gestor.biofirm@biofirm.local** / `gestor123` (role: gestor)

---

## 🔄 Fase 4: Storage + Compressão ✅ + Cargos/Salário + Arquivos Diversos + Responsividade (Em progresso — 02/09/2026, 85%)

### Entregas 31/08 (concluído)
- ✅ Bucket `storage.buckets:employee-docs` público, 10MB limite, `jpeg/png/webp/pdf/heic` + policies `employee_docs_authenticated_all` / `public_read` (`create_employee_docs_bucket`)
- ✅ `js/compress.js` canvas WebP/JPEG (1280px, 0.72) — economia 1GB (~2000 fotos vs ~250)
- ✅ Cadastro completo no `dashboard.html` (foto + 5 anexos com preview/compressão) + `js/dashboard.js` upload `supabase.storage.from('employee-docs').upload()`

### Entregas 02/09 (concluído)
- ✅ **Cargos com salário fixo herdado** (`dashboard.html:190`, `js/dashboard.js:143`, `public.positions`): tabela `positions` (nome unique, setor, salario_base, RLS admin/gestor/manager), `employees.cargo_id FK + salario + salario_moeda`, trigger `sync_salario_from_position` (herança automática), `Cargo/Função *` virou `<select>` com `Salário readonly` (`maskMoney`), modal `Cargos & Setores` CRUD (criar/editar/excluir), ficha lateral/view/PDF com `R$`
- ✅ **Arquivos diversos** (`dashboard.html:271`, `js/dashboard.js:796`, `public.employee_documents`): tabela `employee_documents` (tipo `certificado/doc_filho/outro`, titulo, url em `employee-docs/diversos/`, RLS), fieldset com `Tipo/Título/Arquivo` + `+ Adicionar`, fila `pendingDiversos` para criação e envio imediato em edição, lista com remover, exibição na ficha/PDF
- ✅ **Responsividade** (`css/style.css:885`, `dashboard.html:22`, `js/dashboard.js:795`): hamburger `btnMobileNav` (☰/✕) `<768px` com `app-nav.open` dropdown, breakpoints 1024/768/640/480, filtros empilhados (`min-height 44px`), tabela `min-width 620px` scroll swipe, modais `max-height 94vh` margens 12px, touch targets 44px, `font-size 16px` evita zoom iOS

### Objetivos restantes
- [x] Configurar Supabase Storage para upload de documentos
- [x] Upload de fotos e documentos (PDF, JPEG) com limite de 10MB + compressão
- [x] Visualização de anexos no detalhe do funcionário (ficha lateral + modal)
- [x] CRUD Cargos com salário fixo + Arquivos diversos
- [x] Responsividade (hamburger 480/640/768/1024)
- [ ] Painel do colaborador (rota `/colaborador.html`)
  - Login com credenciais de colaborador
  - Visualização e edição dos próprios dados
  - Upload de documentos pessoais (inclui `employee_documents`)
  - Policy RLS: colaborador edita apenas próprio registro

### Dependências
- Supabase Storage buckets configurados (inclui `diversos/`)
- Policy RLS para `user` role em employees + `positions`/`employee_documents`

---

## 🔄 Fase 5: Exportação PDF ✅ + Reset de Senha (Em progresso - 02/09/2026, 50%)

### Objetivos
- [x] Exportação de ficha do funcionário em PDF (`js/dashboard.js:1314` via `jsPDF`): foto + 5 docs + **salário fixo do cargo** (`positions.salario_base`/`employees.salario`) + **arquivos diversos** (`employee_documents` links) — seção `Cargo/Função — Salário fixo` + `Arquivos diversos` já em produção
- [x] CRUD de Cargos e Setores com salário fixo (`public.positions`, `dashboard.html:190` select + `cargoModal`) — concluído 02/09 (dropdown herdando salário)
- [ ] Reset de senha por gestor (gera senha temporária, colaborador troca no primeiro login)

### Dependências
- Tabela `positions` (já criada) — `setores` desnormalizado em `positions.setor`
- Edge Function para reset de senha

---

## 📋 Fase 6: PWA & Compliance (LGPD) (Planejado - Out/2026)

### Objetivos
- [ ] Manifest.json para PWA (ícones, nome, tema)
- [ ] Service Worker para cache offline
- [ ] Tema escuro (toggle no header)
- [ ] Termo de consentimento LGPD (modal no primeiro acesso)
- [ ] Política de privacidade e tratamento de dados

### Dependências
- Ícones em múltiplos tamanhos
- Service Worker implementado

---

## ✅ Fase 7: Migração para Neon (Concluída - 22/11/2026)

### Entregas
- ✅ **Neon Postgres**: projeto `biofirme`, branch `production`, PostgreSQL 18. Schema único em `db/schema.sql`, aplicado com `npm run db:migrate`. Banco iniciado vazio.
- ✅ **API serverless** em `api/` (Vercel Functions): `auth`, `employees`, `positions`, `documents`, `uploads`, `files`, `health` + helpers em `api/_lib/` (`http`, `db`, `auth`, `storage`, `validate`).
- ✅ **Autenticação própria**: `profiles.password_hash` com bcrypt (custo 12), JWT assinado com `AUTH_SECRET` em cookie `httpOnly; SameSite=Lax; Secure`. Validação server-side no carregamento do dashboard. RBAC nas APIs.
- ✅ **Usuários seed**: `marcus.rolim` e `gestor.biofirm` (ambos admin, senha definida via `.env.local`).
- ✅ **Neon Object Storage**: bucket privado `biofirme`, URL presigned de PUT (`/api/uploads`) e redirect assinado de GET (`/api/files?key=`). CORS configurado por `npm run storage:setup`.
- ✅ **Remoção completa do Supabase**: SDK e `js/supabase.js` removidos; `js/api.js` adicionado; HTML atualizado; nenhuma credencial versionada.
- ✅ **Compressão**: imagens (canvas → WebP/JPEG) e PDFs (pdf.js + jsPDF no cliente, com preservação do original se não houver economia). CLI `npm run compress` com modos `auto`/`lossless`/`raster` (auto: lossless primeiro, raster se economia < 15%).
- ✅ **Correção**: syntax error preexistente em `js/animations.js` (chave extra) corrigido.
- ✅ **Verificação**: `npm test` (DB + storage), teste de integração completo da API (login, CRUD de cargo/funcionário, presign, upload, leitura, documento, cascata, logout) e compressão (imagem 94%, PDF 47%).

### Usuários atuais
| Usuário | Role |
|---------|------|
| `marcus.rolim` | admin |
| `gestor.biofirm` | admin |

Senhas definidas em `.env.local`, nunca versionadas.

---

## 🔧 Stack Tecnológica Final (22/11/2026)

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | HTML5 + CSS3 + JavaScript vanilla + GSAP + `js/api.js` + `js/compress.js` + responsividade hamburger/breakpoints 480/640/768/1024 |
| **Backend** | Vercel Functions (`api/`) com `@neondatabase/serverless` |
| **Banco** | Neon Postgres — `db/schema.sql`, tabelas `employees`, `positions`, `profiles`, `employee_documents` |
| **Autenticação** | bcryptjs + jsonwebtoken em cookie `httpOnly` (RBAC nas APIs) |
| **Storage** | Neon Object Storage, bucket privado `biofirme`, presigned PUT/GET |
| **Compressão** | Cliente (WebP + pdf.js/jsPDF) + CLI (sharp + pdf-lib + pdf.js) |
| **Hospedagem** | Vercel (frontend + funções) |
| **Validações** | ViaCEP + CPF/RG 7-13/CTPS/PIS máscaras + whitelist/validação no servidor |

---

## 📝 Notas de Implementação

### Migrations Aplicadas (até 02/09/2026)
1. `20260101000000_align_users_employees_structure` - Constraints, índices, trigger updated_at
2. `20260101000100_rls_policies` - Policies RLS iniciais + grants
3. `20260101000200_security_definer_fix` - Revoga acesso anon a funções sensíveis
4. `20260101000300_employees_rpc` - Função current_user_role() + policies simplificadas
5. `20260101000400_auth_migration` - Profiles + trigger on_auth_user_created + policies finais
6. `20260101000500_fix_profiles_policies` - Corrige recursão infinita em policy de profiles
7. `20260101000600_add_employee_address_fields` - Colunas endereço (rg, data_nascimento, telefone, email, cep, logradouro, numero, complemento, bairro, cidade, uf)
8. `add_cadastro_completo_foto_docs` (31/08) - `foto_url`, `ctps_numero`, `pis_pasep`, `rg_frente_url`, `rg_verso_url`, `cpf_doc_url`, `comprovante_endereco_url`, `ctps_doc_url` + fix CHECKs + índices pis/ctps
9. `create_employee_docs_bucket` (31/08) - Bucket `employee-docs` público 10MB + policies
10. `add_positions_salario_e_docs_diversos` (02/09) - `positions` (nome unique, setor, salario_base, triggers/RLS) + `employees.cargo_id/salario/salario_moeda` + trigger `sync_salario_from_position` + backfill + `employee_documents` (tipo/titulo/url, RLS)

### Arquivos Principais (22/11)
- `index.html` - Login
- `dashboard.html` - Dashboard + cadastro completo + cargos/salário + arquivos diversos + hamburger
- `css/style.css` - Design System + responsividade
- `js/app.js` - Login
- `js/api.js` - Cliente da API (substitui `js/supabase.js`)
- `js/dashboard.js` - CRUD + cargos + arquivos diversos + ficha/PDF
- `js/compress.js` - Compressão client-side de imagens e PDFs
- `js/mask.js` - Máscaras (CPF, RG, CTPS, PIS, CEP, telefone, money)
- `api/` - Vercel Functions + `api/_lib/`
- `db/schema.sql` - Schema PostgreSQL (Neon)
- `scripts/` - migrate, seed, setup-storage, compress, smoke-test, dev-server
- `.env.local` - credenciais locais (gitignore)

### Comandos Úteis
```bash
npm install
npm run db:migrate      # aplica db/schema.sql
npm run db:seed         # cria os dois admins
npm run storage:setup   # CORS + teste PUT/GET/DELETE
npm run dev             # http://localhost:3000
npm test                # smoke test (DB + storage)
npm run compress -- <arquivo|pasta> --pdf-mode auto
```

---

## 🎯 Próximos Passos Imediatos (22/11)

1. **Configurar as variáveis de ambiente na Vercel** (ver README/PRD) e validar o deploy.
2. **Revogar a antiga secret key do Supabase** que esteve versionada em versões anteriores do PRD.
3. **Painel do colaborador** `/colaborador.html` com permissões por role nas APIs.
4. **Reset de senha por gestor** (senha temporária + troca no primeiro login).
5. **Refinar PDF contábil** com layout de salário/diversos validado com RH.
6. **Validação CTPS/PIS dígito** + LGPD/PWA (Fase 6).

---

**Documento mantido por:** Equipe Biofirm  
**Contato:** [adicionar contato se necessário]
