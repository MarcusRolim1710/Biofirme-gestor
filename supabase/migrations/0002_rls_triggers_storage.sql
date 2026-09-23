-- ============================================================================
-- Biofirm Gestor — RLS + Triggers + Storage (aplicar em projeto EXISTENTE)
-- Cole TODO este arquivo no SQL Editor do Supabase e execute (Run).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- 1. FUNÇÕES (pré-requisito das policies/triggers) ----------------------------

create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, 'user')
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.sync_employee_from_position()
returns trigger language plpgsql as $$
declare p record;
begin
  if new.cargo_id is not null then
    select nome, setor, salario_base into p from public.positions where id = new.cargo_id;
    if found then
      new.cargo := p.nome;
      new.setor := coalesce(nullif(new.setor,''), p.setor);
      new.salario := p.salario_base;
    end if;
  end if;
  return new;
end $$;

-- 2. RLS ----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.employee_documents enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "positions_select" on public.positions;
create policy "positions_select" on public.positions for select to authenticated
  using (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "positions_insert" on public.positions;
create policy "positions_insert" on public.positions for insert to authenticated
  with check (public.current_user_role() in ('admin','gestor'));

drop policy if exists "positions_update" on public.positions;
create policy "positions_update" on public.positions for update to authenticated
  using (public.current_user_role() in ('admin','gestor'));

drop policy if exists "positions_delete" on public.positions;
create policy "positions_delete" on public.positions for delete to authenticated
  using (public.current_user_role() in ('admin','gestor'));

-- employees: leitura/escrita admin, gestor, manager; exclusão só admin/gestor
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

drop policy if exists "employee_documents_select" on public.employee_documents;
create policy "employee_documents_select" on public.employee_documents for select to authenticated
  using (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employee_documents_insert" on public.employee_documents;
create policy "employee_documents_insert" on public.employee_documents for insert to authenticated
  with check (public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employee_documents_delete" on public.employee_documents;
create policy "employee_documents_delete" on public.employee_documents for delete to authenticated
  using (public.current_user_role() in ('admin','gestor'));

-- 3. TRIGGERS -----------------------------------------------------------------

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

-- 4. STORAGE (bucket privado + allowlist de tipos) ----------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-docs', 'employee-docs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "employee_docs_select" on storage.objects;
create policy "employee_docs_select" on storage.objects for select to authenticated
  using (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employee_docs_insert" on storage.objects;
create policy "employee_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employee_docs_update" on storage.objects;
create policy "employee_docs_update" on storage.objects for update to authenticated
  using (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor','manager'));

drop policy if exists "employee_docs_delete" on storage.objects;
create policy "employee_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'employee-docs' and public.current_user_role() in ('admin','gestor'));
