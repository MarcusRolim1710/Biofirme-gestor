# PRD - Sistema de Cadastro de Funcionários - Biofirm

**Última atualização:** 31/08/2026 — Cadastro completo (foto + CTPS/PIS + anexos + compressão)

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
- Exportação da ficha do funcionário em PDF (PRF) para contabilidade — agora com foto + 5 anexos
- Recuperação/reset de senha por gestor
- Definição e gestão de cargos e setores (CRUD separado)
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

#### `public.employees` _(atualizado 31/08/2026)_
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
- `cargo` (text, nullable)
- `setor` (text, nullable)
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
- **Índices:** cpf (unique), setor, status, name, email, cep, `pis_pasep`, `ctps_numero`
- **Trigger:** `trg_employees_updated_at` atualiza `updated_at` automaticamente
- **RLS habilitado:**
  - SELECT: todos autenticados
  - INSERT/UPDATE: apenas admin, gestor, manager
  - DELETE: apenas admin
- **Storage:** bucket `storage.buckets:employee-docs` (público, 10MB limite, `jpeg/png/webp/pdf/heic`) + policies `employee_docs_authenticated_all` / `employee_docs_public_read` — uploads via `js/compress.js` → `supabase.storage.from('employee-docs').upload()`

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
-- Dispara ao atualizar employees, atualiza coluna updated_at
```

## 6. Fluxos de Trabalho (atualizado 31/08/2026)
1. **Vínculo**: Ao criar ou atualizar funcionário, Gestor define status de vínculo: *Ativo* ou *Inativo (Demitido)*.
   - Funcionários inativos não aparecem em listas padrão, mas mantêm histórico acessível.
   - Exportação para contabilidade permite filtrar por período de atividade.
2. **Cadastro**: Gestor cria funcionário → status *Sem dados*. Foto de perfil opcional.
3. **Preenchimento completo**: Gestor/colaborador preenche dados pessoais (**RG 7-13 dígitos, CTPS, PIS/PASEP**) + endereço (ViaCEP) + anexa **5 documentos obrigatórios**: RG frente, RG verso, CPF cópia, Comprovante de endereço, CTPS cópia (cada até 10MB, `js/compress.js` comprime imagens para WebP ~75% antes do upload para `employee-docs`).
4. **Validação**: Sistema valida CPF (dígito verificador), RG (7-13), CTPS/PIS (máscaras), CEP (ViaCEP) automaticamente. Status muda para *Pendente de Documentos* se faltar anexo.
5. **Aprovação**: RH/Gestor revisa foto + docs na ficha (`dashboard.html` modal) e aprova → status *Aprovado pelo RH*.
6. **Exportação**: RH seleciona funcionário e exporta PDF (futuro: incluir foto + anexos) → status *Enviado para Contabilidade*.

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

### Arquitetura (Atualizada 31/08/2026)
- **Frontend**: HTML5 + CSS3 + JavaScript puro + `js/compress.js` (canvas WebP/JPEG) - PWA responsivo
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage `employee-docs` + RLS)
- **Autenticação**: Supabase Auth nativo com JWT automático e Row Level Security
- **Hospedagem**: Compatível com Vercel (frontend estático) + Supabase (backend serverless) — 1GB Storage com compressão client-side

### Segurança
- **RLS (Row Level Security)**: Policies por role em todas as tabelas
- **JWT**: Tokens gerados automaticamente pelo Supabase Auth
- **Consentimento LGPD**: A ser implementado (Fase 6)
- **Criptografia**: Senhas hasheadas pelo Supabase Auth (bcrypt)

### Integrações Ativas
- **ViaCEP API**: Busca automática de endereço por CEP
- **Validação client-side**: CPF (dígito verificador), RG (7-13), CTPS (`000000/000-0`), PIS (`000.00000.00-0`), CEP, telefone
- **Supabase Storage `employee-docs`**: Bucket público 10MB, policies RLS, uploads com `js/compress.js` (WebP 0.72, max 1280px) para economizar 1GB

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
- **Layout**: Estrutura de colunas assimétrica (2/3 + 1/3), cards com borda superior fina em dourado, linhas verticais finas (hairline) entre seções.
- **Assinatura visual**: Emblema/selo dourado estilo heráldico no cabeçalho com nome "Biofirm".

## 10. Fora do Escopo (v1)
- Definição de itens fora da versão inicial ainda não consolidada – será refinada durante o desenvolvimento.

## 11. Critérios de Sucesso
- Redução do tempo de busca de documentos em >80%.
- Zero perda de documentos.
- Exportação de ficha em < 1 minuto.
- Adoção por 100% dos gestores e colaboradores no primeiro mês.

## 12. Stack Técnica Atual (31/08/2026)

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | HTML5 + CSS3 + JavaScript ES6+ (vanilla) + `js/compress.js` (canvas compressão) |
| **Backend** | Supabase (PostgreSQL + Auth + RLS + Edge Functions + Storage `employee-docs`) |
| **Autenticação** | Supabase Auth (JWT automático) |
| **Storage** | Supabase Storage `employee-docs` (público, 10MB, `jpeg/png/webp/pdf/heic`, compressão ~75%) |
| **Deploy** | Vercel (frontend) + Supabase (backend) |
| **Desenvolvimento** | `npx http-server -p 8080` |

## 13. Estrutura de Arquivos

```
Biofirme/
├── index.html          # Tela de login
├── dashboard.html      # Dashboard + cadastro completo (foto, CTPS/PIS, 5 anexos)
├── css/
│   └── style.css       # Design System + file inputs documentais
├── js/
│   ├── app.js          # Lógica de login
│   ├── dashboard.js    # CRUD + uploads comprimidos + ficha com docs
│   ├── mask.js         # Máscaras (CPF, RG 7-13, CTPS, PIS, CEP, telefone)
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

## 15. Próximos Passos (31/08/2026)

1. **Deploy Vercel** - Frontend estático pronto (inclui cadastro completo)
2. **Painel do Colaborador** - Rota `/colaborador.html` com RLS por auth.uid() (reutiliza `employee-docs`)
3. **Exportação PDF** - Ficha com foto + 5 anexos para contabilidade
4. **CRUD Cargos/Setores** - Tabelas auxiliares com dropdown dinâmico
5. **Validação CTPS/PIS** - Dígito verificador (hoje só máscara)

---

**Documento atualizado em:** 31/08/2026  
**Versão:** 2.1 (Cadastro completo + Storage + compressão)

## 16. Variáveis de Ambiente (.env)
```
SUPABASE_URL=https://vbqxgvyfcgfdlkdjclce.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_XixX1IJ7rfypeMk5UcXPvg_H6mMxhEt
SUPABASE_SECRET_KEY=sb_secret_mQoZNp2g5YCLNOoG5fliuQ_TAEry-z9
```