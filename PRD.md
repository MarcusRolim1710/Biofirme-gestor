# PRD - Sistema de Cadastro de Funcionários - Biofirm

**Última atualização:** 02/09/2026 — Cargos com salário fixo herdado + Arquivos diversos + Responsividade

## 1. Visão Geral
Sistema web PWA para centralizar, armazenar e gerenciar o cadastro de funcionários da Biofirm, substituindo o uso atual de WhatsApp, documentos .docx e imagens soltas. O objetivo é garantir rastreabilidade, segurança e agilidade na consulta e entrega de dados à contabilidade.

### Arquitetura Atual
- **Frontend:** HTML5 + CSS3 + JavaScript vanilla (sem frameworks)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **Autenticação:** Supabase Auth com JWT + Row Level Security (RLS)
- **Hospedagem:** Compatível com Vercel (frontend estático) + Supabase (backend serverless)

## 2. Público-alvo
- **Gestores/RH**: criam, editam, visualizam, baixam e deletam registros.
- **Colaboradores**: editam seus próprios dados e baixam sua ficha.
- **Contabilidade**: visualiza e baixa fichas completas (via login no sistema).

## 3. Proposta de Valor Única
Centralizar toda a documentação do funcionário em um único local, com validação automática de dados, fluxo de aprovação e exportação simplificada para a contabilidade.

## 4. Funcionalidades (MVP)

### ✅ Implementadas (31/08/2026)
- **Autenticação Supabase Auth nativa**: Login com email/senha, JWT automático, sessão persistente
- **CRUD completo de funcionários** com RLS (Row Level Security) por role
- **Validações em tempo real**:
  - **CPF**: validação por dígito verificador, máscara automática `000.000.000-00`
  - **RG**: validação de formato (**7 a 13 dígitos**, `js/mask.js:19`, `js/dashboard.js:418`), máscara `00.000.000-00000` (`dashboard.html:163` maxlength 16) — suporta RG longo `2003099021736` → `20.030.990-21736`, corrigido de `maxlength 12` para `16`
  - **CEP**: busca automática via ViaCEP, preenchimento de logradouro, bairro, cidade e UF
  - **Telefone**: máscara automática `(00) 00000-0000`
  - **CTPS**: máscara `000000/000-0` (`js/mask.js:66`), campo `ctps_numero`
  - **PIS/PASEP**: máscara `000.00000.00-0` (`js/mask.js:56`), campo `pis_pasep`
- **Cadastro completo (31/08/2026)** — `dashboard.html` + `js/dashboard.js` + `js/compress.js`:
  - **Foto de perfil** circular com preview e upload para `storage.buckets:employee-docs/foto/*`
  - **Campos novos**: `ctps_numero` (CTPS), `pis_pasep` (PIS/PASEP)
  - **Anexos documentais** (5 arquivos, `image/*` ou `application/pdf`, até 10MB cada, compressão automática): `RG frente*`, `RG verso*`, `CPF cópia`, `Comprovante de endereço`, `Carteira de Trabalho cópia` → colunas `rg_frente_url`, `rg_verso_url`, `cpf_doc_url`, `comprovante_endereco_url`, `ctps_doc_url`
  - **Compressão client-side** `js/compress.js` (canvas → WebP 0.72/JPEG fallback, `maxWidth 1280` / foto `800`, `maxSizeMB 0.6`) economiza ~75% e viabiliza o limite de **1GB** do Supabase Storage (~2000 fotos vs ~250 sem compressão)
  - **Supabase Storage** bucket `employee-docs` (público, 10MB limite, mime `jpeg/png/webp/pdf/heic`) + policies `employee_docs_authenticated_all` (authenticated all) e `employee_docs_public_read` (public select)
  - **UI**: ficha lateral com thumb foto + contador `X/5 docs`, modal ficha com galeria de links, tabela com avatar

### ✅ Implementadas (02/09/2026) — Cargos com salário fixo + Arquivos diversos + Responsividade
- **Cargos com salário fixo herdado** (`dashboard.html:190`, `js/dashboard.js:143`, `public.positions` + `employees.cargo_id/salario`):
  - Nova tabela `public.positions` (`id bigint PK`, `nome text unique`, `setor text`, `salario_base numeric(12,2)`, `descricao`, `created_at/updated_at`) com RLS `positions_select_authenticated` (todos auth), `insert/update` admin/gestor/manager, `delete` admin
  - `employees.cargo_id bigint FK → positions.id ON DELETE SET NULL` + `salario numeric(12,2)` + `salario_moeda text default 'BRL'` + índices `idx_employees_cargo_id/salario`
  - Trigger `sync_salario_from_position()` (`BEFORE INSERT OR UPDATE OF cargo_id`) copia `salario_base → salario` e sincroniza `cargo`/`setor` texto (herança automática); `employees.cargo` mantido denormalizado para compatibilidade
  - UI: `Cargo/Função *` virou `<select>` populado via `supabase.from('positions').select('*')` (`js/dashboard.js:143 fetchPositions/renderCargoSelect`), campo `Salário (herdado do cargo)` readonly com `maskMoney` (`js/mask.js:84`) e `cargoSalarioInfo` dinâmico; botão `⚙ Cargos` e nav `Cargos & Setores` abrem `cargoModal` (CRUD completo: criar/editar/excluir, máscara `R$`, `parseMoneyBRL` com `replace(/\./g)`)
  - Validação: `cargo_id` obrigatório ao salvar (`js/dashboard.js:1060`); salário não editável por funcionário — fonte única é `positions.salario_base`
  - Tabela, ficha lateral (`js/dashboard.js:436`) e ficha completa (`js/dashboard.js:1149`) + PDF (`js/dashboard.js:1314`) exibem `cargo · setor · R$` (ex: `Farmacêutico · Laboratório · R$ 5.500,50`)
- **Arquivos diversos — Certificados, Docs Filhos, Outros** (`dashboard.html:271`, `js/dashboard.js:796`, `public.employee_documents`):
  - Nova tabela `public.employee_documents` (`id bigint PK`, `employee_id bigint FK → employees.id CASCADE`, `tipo text CHECK certificado/doc_filho/outro`, `titulo text`, `url text`, `mime`, `tamanho_bytes`, `created_at`) com índices `employee_id/tipo` e RLS `emp_docs_*` (select todos auth, insert/update admin/gestor/manager, delete admin/gestor)
  - Storage: subpasta `employee-docs/diversos/{employee_id}/` (`js/dashboard.js:838 uploadFile`), compressão `compressImage 1280/0.72` reaproveitada (imagem) e 10MB limite
  - UI: fieldset `Arquivos Diversos` no modal de funcionário (`Tipo` select + `Título` + `Arquivo` + `+ Adicionar`); lista `docDiversosList` com links/abrir e remover; modo criação usa fila `pendingDiversos` (enviados após `insert employees`), modo edição envia imediato (`insert employee_documents`); ficha/PDF ganharam seção dedicada com links
- **Responsividade completa (mobile 480/640/768/1024)** (`css/style.css:885`, `dashboard.html:22`, `js/dashboard.js:795`):
  - Header com hamburger `btnMobileNav` (☰/✕) visível só `<768px`, nav vira dropdown absoluto `top:60px` com toggle `open` + fechamento por clique fora/link
  - Breakpoints: `1024` grid 2fr→1fr; `768` header 60px, filtros empilhados (`min-height 44px`), `form-grid 1fr`, modais margem 12px `max-height 94vh` e botões 44px; `640` tabela `min-width 620px` com `overflow-x:auto` swipe; `480` `stats-grid 1col`, `h1 26px`, inputs `font-size 16px` (evita zoom iOS), touch targets 44px
  - `scrollbar-width: thin` para nav/tabela; `index.html` já tinha `viewport`
- **Perfis de acesso via RLS**:
  - `admin`: CRUD completo em employees
  - `gestor`: INSERT/UPDATE em employees, SELECT próprio profile
  - `manager`: INSERT/UPDATE em employees
  - `user`: SELECT próprio profile (preparado para painel do colaborador)
- **Dashboard com métricas em tempo real**: Total, Ativos, Pendentes, Aprovados
- **Filtros e busca**: por nome, CPF, cargo, setor, status, vínculo
- **Triggers automáticos**: `updated_at` em employees, criação de profile ao registrar user em auth.users
- **Constraints e índices**: CPF único, status/vínculo validados, índices em setor/status/cpf/email

### 🚧 Pendentes
- Painel do colaborador para atualizar seus próprios dados (`/colaborador.html` com RLS por `auth.uid()`)
- Exportação da ficha do funcionário em PDF (PRF) para contabilidade — agora com foto + 5 anexos + salário fixo do cargo + arquivos diversos
- Recuperação/reset de senha por gestor
- Validação CTPS/PIS por dígito verificador (hoje só máscara)
- **Concluído em 02/09**: CRUD Cargos/Setores com salário fixo + Arquivos diversos (certificados/docs filhos) + Responsividade (movido para implementadas)
- **Concluído em 31/08**: Upload de anexos com compressão (movido para implementadas)

## 6. Modelo de Dados (Supabase)

### Tabelas Principais

#### `auth.users` (Supabase Auth nativo)
- `id` (uuid, PK)
- `email` (text, unique)
- `encrypted_password` (text)
- `email_confirmed_at` (timestamptz)
- `raw_user_meta_data` (jsonb) - armazena `username` e `role` inicial

#### `public.profiles`
- `id` (uuid, PK, FK → auth.users.id)
- `username` (text, unique, NOT NULL)
- `role` (text, NOT NULL, CHECK: admin|gestor|manager|user, DEFAULT: user)
- `created_at` (timestamptz, DEFAULT: now())
- **RLS habilitado:** usuários autenticados leem próprio profile
- **Trigger:** `on_auth_user_created` cria profile automaticamente ao inserir em auth.users

#### `public.employees` _(atualizado 02/09/2026)_
- `id` (bigint, PK, autoincrement)
- `name` (text, NOT NULL)
- `cpf` (text, unique, NOT NULL)
- `rg` (text, nullable) — aceita 7-13 dígitos, máscara `00.000.000-00000`
- `ctps_numero` (text, nullable) — CTPS `000000/000-0`
- `pis_pasep` (text, nullable) — PIS `000.00000.00-0`
- `foto_url` (text, nullable) — URL pública `storage:employee-docs/foto/*`
- `rg_frente_url` (text, nullable) — RG frente
- `rg_verso_url` (text, nullable) — RG verso
- `cpf_doc_url` (text, nullable) — cópia CPF
- `comprovante_endereco_url` (text, nullable) — comprovante endereço
- `ctps_doc_url` (text, nullable) — cópia CTPS
- `data_nascimento` (date, nullable)
- `telefone` (text, nullable)
- `email` (text, nullable)
- `cargo` (text, nullable) — denormalizado, sincronizado via trigger `sync_salario_from_position` a partir de `positions.nome`
- `cargo_id` (bigint, nullable, FK → `public.positions.id ON DELETE SET NULL`) — vínculo com cargo de salário fixo _(02/09)_
- `salario` (numeric(12,2), nullable, CHECK >=0) — herdado de `positions.salario_base` via trigger _(02/09)_
- `salario_moeda` (text, NOT NULL, DEFAULT 'BRL') _(02/09)_
- `setor` (text, nullable) — sincronizado com `positions.setor` quando cargo definido
- `status` (text, nullable, CHECK: 'Sem dados'|'Pendente de Documentos'|'Aprovado pelo RH'|'Enviado para Contabilidade'|'Ativo'|'Inativo'|'Afastado'|'Férias') — corrigido em `20260831000000` para incluir `Enviado para Contabilidade` e `Inativo`
- `vinculo` (text, nullable, DEFAULT: 'Ativo', CHECK: 'Ativo'|'Inativo'|'Demitido'|'Afastado'|'Férias') — corrigido para incluir `Inativo`
- `cep` (text, nullable)
- `logradouro` (text, nullable)
- `numero` (text, nullable)
- `complemento` (text, nullable)
- `bairro` (text, nullable)
- `cidade` (text, nullable)
- `uf` (text, nullable)
- `created_at` (timestamptz, DEFAULT: now())
- `updated_at` (timestamptz, DEFAULT: now())
- **Índices:** cpf (unique), setor, status, name, email, cep, `pis_pasep`, `ctps_numero`, `cargo_id`, `salario` _(02/09)_
- **Triggers:** `trg_employees_updated_at` (atualiza `updated_at`) + `trg_employees_sync_salario` (`BEFORE INSERT OR UPDATE OF cargo_id` → `sync_salario_from_position()`) _(02/09)_
- **RLS habilitado:**
  - SELECT: todos autenticados
  - INSERT/UPDATE: apenas admin, gestor, manager
  - DELETE: apenas admin
- **Storage:** bucket `storage.buckets:employee-docs` (público, 10MB limite, `jpeg/png/webp/pdf/heic`) + policies `employee_docs_authenticated_all` / `employee_docs_public_read` — uploads via `js/compress.js` → `supabase.storage.from('employee-docs').upload()`; subpastas `foto/*` e `diversos/{employee_id}/*` _(02/09)_

#### `public.positions` _(novo 02/09/2026)_
- `id` (bigint, PK, autoincrement)
- `nome` (text, NOT NULL, unique)
- `setor` (text, nullable)
- `salario_base` (numeric(12,2), NOT NULL, CHECK >=0) — salário fixo do cargo
- `descricao` (text, nullable)
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())
- **Índices:** `nome` (unique), `setor`
- **Trigger:** `trg_positions_updated_at` (`BEFORE UPDATE` → `set_updated_at()`)
- **RLS habilitado:**
  - SELECT: todos autenticados (`positions_select_authenticated`)
  - INSERT/UPDATE: admin, gestor, manager (`positions_insert/update_admin_gestor_manager`)
  - DELETE: apenas admin (`positions_delete_admin`)

#### `public.employee_documents` _(novo 02/09/2026)_
- `id` (bigint, PK, autoincrement)
- `employee_id` (bigint, NOT NULL, FK → `public.employees.id ON DELETE CASCADE`)
- `tipo` (text, NOT NULL, CHECK `certificado`|`doc_filho`|`outro`)
- `titulo` (text, NOT NULL)
- `url` (text, NOT NULL) — `storage:employee-docs/diversos/*` (public URL)
- `mime` (text, nullable)
- `tamanho_bytes` (int, nullable, CHECK >0)
- `created_at` (timestamptz, DEFAULT now())
- **Índices:** `employee_id`, `tipo`
- **RLS habilitado:**
  - SELECT: todos autenticados (`emp_docs_select_authenticated`)
  - INSERT/UPDATE: admin, gestor, manager (`emp_docs_insert/update_admin_gestor_manager`)
  - DELETE: admin, gestor (`emp_docs_delete_admin_gestor`)

#### `public.users` (legado, mantido para compatibilidade)
- `id` (bigint, PK)
- `username` (text, unique, NOT NULL)
- `password` (text, NOT NULL) - **deprecado, migrar para Supabase Auth**
- `role` (text, NOT NULL, CHECK: admin|manager|gestor|user, DEFAULT: user)
- `created_at` (timestamptz, DEFAULT: now())

### Funções e Triggers

#### `public.current_user_role()`
```sql
RETURNS text SECURITY DEFINER STABLE
-- Retorna role do usuário autenticado via auth.uid()
```

#### `public.handle_new_user()`
```sql
RETURNS trigger SECURITY DEFINER
-- Dispara ao inserir em auth.users, cria profile automaticamente
```

#### `public.set_updated_at()`
```sql
RETURNS trigger
-- Dispara ao atualizar employees/positions, atualiza coluna updated_at
```

#### `public.sync_salario_from_position()` _(02/09)_
```sql
RETURNS trigger LANGUAGE plpgsql
-- BEFORE INSERT OR UPDATE OF cargo_id ON employees
-- Copia positions.salario_base → employees.salario e sincroniza cargo/setor texto
```

## 6. Fluxos de Trabalho (atualizado 02/09/2026)
1. **Vínculo**: Ao criar ou atualizar funcionário, Gestor define status de vínculo: *Ativo* ou *Inativo (Demitido)*.
   - Funcionários inativos não aparecem em listas padrão, mas mantêm histórico acessível.
   - Exportação para contabilidade permite filtrar por período de atividade.
2. **Cadastro**: Gestor cria funcionário → status *Sem dados*. Foto de perfil opcional. **Cargo obrigatório** — selecionado via `positions` (dropdown) com salário herdado.
3. **Cargos com salário fixo** _(02/09)_: Gestor cadastra cargos em `Cargos & Setores` (`cargoModal`) com `nome`, `setor` e `salario_base` (ex: `Farmacêutica · Laboratório · R$ 5.500,50`). Ao vincular funcionário ao cargo (`employees.cargo_id`), trigger `sync_salario_from_position` herda `salario_base → salario` e sincroniza `cargo`/`setor` texto — salário não é editável no funcionário, fonte única é o cargo.
4. **Preenchimento completo**: Gestor/colaborador preenche dados pessoais (**RG 7-13 dígitos, CTPS, PIS/PASEP**) + endereço (ViaCEP) + anexa **5 documentos obrigatórios**: RG frente, RG verso, CPF cópia, Comprovante de endereço, CTPS cópia (cada até 10MB, `js/compress.js` comprime imagens para WebP ~75% antes do upload para `employee-docs`) + **arquivos diversos opcionais** (certificados, docs de filhos/outros) em `employee_documents` (`employee-docs/diversos/`, também até 10MB, compressão reaproveitada, fila `pendingDiversos` para criação).
5. **Validação**: Sistema valida CPF (dígito verificador), RG (7-13), CTPS/PIS (máscaras), `cargo_id` obrigatório, CEP (ViaCEP) automaticamente. Status muda para *Pendente de Documentos* se faltar anexo obrigatório.
6. **Aprovação**: RH/Gestor revisa foto + 5 docs + diversos + salário na ficha (`dashboard.html` modal) e aprova → status *Aprovado pelo RH*.
7. **Exportação**: RH seleciona funcionário e exporta PDF (`jsPDF`, `js/dashboard.js:1314`) com foto + 5 docs + salário fixo do cargo + arquivos diversos (links) → status *Enviado para Contabilidade*.

## 7. Permissões (RBAC via Supabase RLS)

| Perfil         | Criar Employee | Editar Employee | Visualizar | Baixar | Deletar | Resetar Senha |
|----------------|----------------|-----------------|------------|--------|---------|---------------|
| admin          | ✅             | ✅              | ✅ (todos) | ✅     | ✅      | ✅ (futuro)   |
| gestor         | ✅             | ✅              | ✅ (todos) | ✅     | ❌      | ✅ (futuro)   |
| manager        | ✅             | ✅              | ✅ (todos) | ✅     | ❌      | ❌            |
| user           | ❌             | ✅ (próprio)    | ✅ (próprio) | ✅ (próprio) | ❌ | ❌       |

**Implementação:**
- Policies RLS checam `current_user_role()` que retorna role de `profiles.role` via `auth.uid()`
- Autenticação via Supabase Auth com JWT automático
- SessionStorage persiste sessão no frontend

## 8. Requisitos Não Funcionais

### Arquitetura (Atualizada 02/09/2026)
- **Frontend**: HTML5 + CSS3 + JavaScript puro + `js/mask.js` (`maskMoney` para R$) + `js/compress.js` (canvas WebP/JPEG) - PWA responsivo com hamburger mobile (`btnMobileNav` + `app-nav.open`, `js/dashboard.js:795`) e breakpoints 480/640/768/1024 (`css/style.css:885`)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage `employee-docs` com subpastas `foto/*` e `diversos/*` + RLS `positions`/`employee_documents` + trigger `sync_salario_from_position`)
- **Autenticação**: Supabase Auth nativo com JWT automático e Row Level Security
- **Hospedagem**: Compatível com Vercel (frontend estático) + Supabase (backend serverless) — 1GB Storage com compressão client-side

### Segurança
- **RLS (Row Level Security)**: Policies por role em todas as tabelas
- **JWT**: Tokens gerados automaticamente pelo Supabase Auth
- **Consentimento LGPD**: A ser implementado (Fase 6)
- **Criptografia**: Senhas hasheadas pelo Supabase Auth (bcrypt)

### Integrações Ativas
- **ViaCEP API**: Busca automática de endereço por CEP
- **Validação client-side**: CPF (dígito verificador), RG (7-13), CTPS (`000000/000-0`), PIS (`000.00000.00-0`), CEP, telefone, `cargo_id` obrigatório, `maskMoney` (`js/mask.js:84`, `parseMoneyBRL` com `replace(/\./g)`)
- **Supabase Storage `employee-docs`**: Bucket público 10MB, policies RLS, uploads com `js/compress.js` (WebP 0.72, max 1280px) para economizar 1GB — subpastas `foto/*` (5 docs + foto) e `diversos/{employee_id}/*` (`employee_documents`)

### Usuários de Teste
| Email | Senha | Role |
|-------|-------|------|
| `admin.teste@biofirm.local` | `senha123` | admin |
| `gestor.biofirm@biofirm.local` | `gestor123` | gestor |
- **Desempenho**: Uploads limitados a 10 MB, tempo de resposta < 2s.

## 9. UI/UX - Design System
- **Paleta**:
  - Dourado principal: `#B8943C` (ouro envelhecido)
  - Dourado claro: `#E8D5A3` (fundo de cards)
  - Fundo geral: `#FBF8F0` (creme quente)
  - Texto escuro: `#2E2A24` (marrom escuro)
  - Acento hover/bordas: `#8F7A3A` (dourado queimado)
  - Sucesso/ativo: `#4A7C59` (verde musgo)
- **Tipografia**:
  - Display: Playfair Display (serif, peso 700, itálico)
  - Corpo: Inter (sans-serif, peso 400/500)
  - Dados/monospace: JetBrains Mono
- **Layout**: Estrutura de colunas assimétrica (2/3 + 1/3), cards com borda superior fina em dourado, linhas verticais finas (hairline) entre seções. Responsivo: header hamburger (`btnMobileNav`/`app-nav.open`, `css/style.css:365,885`) + breakpoints 480/640/768/1024, filtros empilhados, tabela `overflow-x:auto min-width 620px`, modais `max-height 94vh` margens 12px, touch targets 44px, `font-size 16px` em inputs (evita zoom iOS).
- **Assinatura visual**: Emblema/selo dourado estilo heráldico no cabeçalho com nome "Biofirm".

## 10. Fora do Escopo (v1)
- Definição de itens fora da versão inicial ainda não consolidada – será refinada durante o desenvolvimento.

## 11. Critérios de Sucesso
- Redução do tempo de busca de documentos em >80%.
- Zero perda de documentos.
- Exportação de ficha em < 1 minuto.
- Adoção por 100% dos gestores e colaboradores no primeiro mês.

## 12. Stack Técnica Atual (02/09/2026)

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | HTML5 + CSS3 + JavaScript ES6+ (vanilla) + `js/mask.js` (`maskMoney`, `parseMoneyBRL`) + `js/compress.js` (canvas WebP) + responsividade hamburger/breakpoints 480/640/768/1024 (`css/style.css:885`) |
| **Backend** | Supabase (PostgreSQL + Auth + RLS + Edge Functions + Storage `employee-docs` com subpastas `foto/diversos` + `positions`/`employee_documents` + trigger `sync_salario_from_position`) |
| **Autenticação** | Supabase Auth (JWT automático) |
| **Storage** | Supabase Storage `employee-docs` (público, 10MB, `jpeg/png/webp/pdf/heic`, compressão ~75%, subpastas `foto/*` e `diversos/*`) |
| **Deploy** | Vercel (frontend) + Supabase (backend) |
| **Desenvolvimento** | `npx http-server -p 8080` |

## 13. Estrutura de Arquivos

```
Biofirme/
├── index.html          # Tela de login (viewport + responsivo)
├── dashboard.html      # Dashboard + cadastro completo (foto, CTPS/PIS, 5 anexos) + cargos/salário (select + cargoModal) + arquivos diversos (diversos fieldset) + hamburger btnMobileNav
├── css/
│   └── style.css       # Design System + file inputs documentais + responsividade (hamburger, breakpoints 480/640/768/1024, tabela scroll, modais 44px)
├── js/
│   ├── app.js          # Lógica de login
│   ├── dashboard.js    # CRUD + positions/salário herdado + arquivos diversos (pendingDiversos/employee_documents) + hamburger + ficha/PDF com salário/diversos
│   ├── mask.js         # Máscaras (CPF, RG 7-13, CTPS, PIS, CEP, telefone, money)
│   ├── compress.js     # Compressão client-side (canvas WebP/JPEG) para 1GB
│   └── supabase.js     # Client Supabase + auth
├── PRD.md              # Este documento
├── ROADMAP.md          # Cronograma
├── package.json        # @supabase/supabase-js
└── .env                # SUPABASE_URL / KEYS (gitignore)
```

## 14. Migrations Aplicadas (Supabase)

| Data | Migration | Descrição |
|------|-----------|-----------|
| 27/08 | `20260101000000_align_users_employees_structure` | Constraints, índices, trigger updated_at |
| 27/08 | `20260101000100_rls_policies` | Policies RLS iniciais |
| 27/08 | `20260101000200_security_definer_fix` | Revoga acesso anon a funções sensíveis |
| 27/08 | `20260101000300_employees_rpc` | Função current_user_role() |
| 27/08 | `20260101000400_auth_migration` | Profiles + trigger + policies RLS finais |
| 27/08 | `20260101000500_fix_profiles_policies` | Corrige recursão infinita |
| 27/08 | `20260101000600_add_employee_address_fields` | Colunas de endereço |
| 31/08 | `add_cadastro_completo_foto_docs` | `foto_url`, `ctps_numero`, `pis_pasep`, `rg_frente_url`, `rg_verso_url`, `cpf_doc_url`, `comprovante_endereco_url`, `ctps_doc_url` + fix CHECKs `status` (`Enviado para Contabilidade`, `Inativo`) e `vinculo` (`Inativo`) + índices `pis`/`ctps` |
| 31/08 | `create_employee_docs_bucket` | Bucket `employee-docs` público 10MB `jpeg/png/webp/pdf/heic` + policies `employee_docs_authenticated_all` / `public_read` |
| 02/09 | `add_positions_salario_e_docs_diversos` | `positions` (nome unique, setor, salario_base, triggers/RLS) + `employees.cargo_id/salario/salario_moeda` + trigger `sync_salario_from_position` + backfill cargos distintos + `employee_documents` (tipo/titulo/url, RLS) |

## 15. Próximos Passos (02/09/2026)

1. **Deploy Vercel** - Frontend estático com cargos/salário + arquivos diversos + responsividade
2. **Painel do Colaborador** - Rota `/colaborador.html` com RLS por auth.uid() (reutiliza `employee-docs` + `employee_documents`)
3. **Exportação PDF** - Já com foto + 5 anexos + salário fixo do cargo + arquivos diversos (links) — refinar layout contábil
4. **Validação CTPS/PIS** - Dígito verificador (hoje só máscara `js/mask.js:56,66`)
5. **PWA & LGPD** - Manifest, Service Worker, tema escuro, termo de consentimento

---

**Documento atualizado em:** 02/09/2026  
**Versão:** 2.3 (Cargos com salário fixo herdado + Arquivos diversos + Responsividade)

## 16. Variáveis de Ambiente (.env)
```
SUPABASE_URL=https://vbqxgvyfcgfdlkdjclce.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_XixX1IJ7rfypeMk5UcXPvg_H6mMxhEt
SUPABASE_SECRET_KEY=sb_secret_mQoZNp2g5YCLNOoG5fliuQ_TAEry-z9
```