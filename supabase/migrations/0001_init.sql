-- ============================================================================
-- Biofirm Gestor — Migration 0001 (baseline: schema + RLS + storage)
-- ----------------------------------------------------------------------------
-- COMO APLICAR:
--   Projeto NOVO:      supabase db push   (ou cole no SQL Editor do painel)
--   Projeto EXISTENTE: se as tabelas já existem, rode as seções 3 (RLS),
--                      4 (triggers) e 5 (storage). Ideal: `supabase db diff`.
--
-- PERFIS (roles): admin | gestor | manager | user
--   admin/gestor -> leitura + escrita + exclusão de colaboradores
--   manager (RH) -> leitura + escrita (sem exclusão)
--   user         -> apenas o próprio perfil (futuro painel do colaborador)
-- ============================================================================

-- 1. TABELAS -----------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  email text,
  role text not null default 'user' check (role in ('admin','gestor','manager','user')),
  created_at timestamptz default now()
);

create table if not exists public.positions (
  id bigint generated always as identity primary key,
  nome text not null,
  setor text,
  salario_base numeric(10,2),
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.employees (
  id bigint generated always as identity primary key,
  name text not null,
  cpf text not null unique,
  rg text,
  ctps_numero text,
  pis_pasep text,
  cargo_id bigint references public.positions(id) on delete set null,
  cargo text,
  setor text,
  salario numeric(10,2),
  vinculo text default 'Ativo',
  status text default 'Pendente de Documentos',
  cep text, logradouro text, numero text, complemento text,
  bairro text, cidade text, uf text,
  data_nascimento date, telefone text, email text,
  -- colunas *_url guardam a CHAVE do objeto no bucket (ex.: 'foto/123_abc.jpg');
  -- registros legados podem conter URL pública completa — o app aceita ambos.
  foto_url text, rg_frente_url text, rg_verso_url text,
  cpf_doc_url text, comprovante_endereco_url text, ctps_doc_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_documents (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  tipo text not null check (tipo in ('certificado','doc_filho','outro')),
  titulo text not null,
  url text not null,           -- chave do objeto no bucket
  mime text,
  tamanho_bytes bigint,
  created_at timestamptz default now()
);

create index if not exists idx_employees_cpf on public.employees(cpf);
create index if not exists idx_employee_documents_employee on public.employee_documents(employee_id);

-- 2. FUNÇÕES ------------------------------------------------------------------

-- papel do usuário logado (security definer evita recursão de RLS em profiles)
create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- cria profile ao registrar usuário no Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'user')
  on conflict (id) do nothing;
  return new;
end $$;

-- sincroniza cargo/setor/salário a partir do cargo selecionado
create or replace function public.sync_employee_from_position()
returns trigger language plpgsql as $$
begin
  if new.cargo_id is not null then
    select p.nome, p.setor, p.salario_base
      into new.cargo, new.setor, new.salario
      from public.positions p
     where p.id = new.cargo_id;
  end if;
  return new;
end $$;

-- 3. ROW LEVEL SECURITY --------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.employee_documents enable row level security;

-- profiles: cada um lê o seu; admin lê todos
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'admin');

-- positions: leitura para todos autenticados; escrita só admin/gestor
drop policy if exists "positions_select" on public.positions;
create policy "positions_select" on public.positions for select to authenticated using (true);

drop policy if exists "positions_write" on public.positions;
create policy "positions_write" on public.positions for insert to authenticated
  with check (public.current_user_role() in ('admin','gestor'));

drop policy if exists "positions_update" on public.positions;
create policy "positions_update" on public.positions for update to authenticated
  using (public.current_user_role() in ('admin','gestor'));

drop policy if exists "positions_delete" on public.positions;
create policy "positions_delete" on public.positions for delete to authenticated
  using (public.current_user_role() in ('admin','gestor'));

-- employees: leitura/escrita para admin/gestor/manager; exclusão só admin/gestor
drop policy if exists "employees_select" on public.employees;
create policy "employees_select" on public.employees for select to authenticated
  using (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employees_insert" on public.employees;
create policy "employees_insert" on public.employees for insert to authenticated
  with check (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employees_update" on public.employees;
create policy "employees_update" on public.employees for update to authenticated
  using (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employees_delete" on public.employees;
create policy "employees_delete" on public.employees for delete to authenticated
  using (public.current_user_role() in ('admin','gestor'));

-- employee_documents: acompanha as permissões de employees
drop policy if exists "employee_documents_select" on public.employee_documents;
create policy "employee_documents_select" on public.employee_documents for select to authenticated
  using (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employee_documents_insert" on public.employee_documents;
create policy "employee_documents_insert" on public.employee_documents for insert to authenticated
  with check (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employee_documents_delete" on public.employee_documents;
create policy "employee_documents_delete" on public.employee_documents for delete to authenticated
  using (public.current_user_role() in ('admin','gestor'));

-- 4. TRIGGERS -----------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists trg_employees_sync_position on public.employees;
create trigger trg_employees_sync_position
  before insert or update of cargo_id on public.employees
  for each row execute function public.sync_employee_from_position();

-- 5. STORAGE (bucket privado + allowlist de tipos) -----------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-docs', 'employee-docs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

-- leitura (necessária para gerar/abrir URLs assinadas): admin, gestor, manager
drop policy if exists "employee_docs_select" on storage.objects;
create policy "employee_docs_select" on storage.objects for select to authenticated
  using (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor','manager'));

-- upload: admin, gestor, manager
drop policy if exists "employee_docs_insert" on storage.objects;
create policy "employee_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor','manager'));

-- sobrescrita: admin, gestor, manager
drop policy if exists "employee_docs_update" on storage.objects;
create policy "employee_docs_update" on storage.objects for update to authenticated
  using (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor','manager'));

-- remoção de arquivos: só admin/gestor
drop policy if exists "employee_docs_delete" on storage.objects;
create policy "employee_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor'));
