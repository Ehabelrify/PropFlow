
-- Roles enum
create type public.app_role as enum ('super_admin', 'manager', 'leader', 'agent');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  avatar_color text not null default 'bg-chart-1',
  initials text not null default '',
  tenant_id text,
  team_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User roles (separate table to prevent privilege escalation)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Approval requests
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.approval_kind as enum ('email', 'password', 'role');

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text,
  kind public.approval_kind not null,
  payload jsonb not null default '{}'::jsonb,
  reason text,
  status public.approval_status not null default 'pending',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

-- Security definer role checker
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Get current user's tenant
create or replace function public.current_tenant()
returns text
language sql stable security definer set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.approval_requests enable row level security;

-- Profiles policies
create policy "profiles_self_read" on public.profiles for select to authenticated
  using (id = auth.uid() or tenant_id = public.current_tenant() or public.has_role(auth.uid(), 'super_admin'));
create policy "profiles_self_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_manager_update" on public.profiles for update to authenticated
  using ((public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin')) and tenant_id = public.current_tenant());

-- User roles policies
create policy "user_roles_self_read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'));
create policy "user_roles_manager_write" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'));

-- Approval policies
create policy "approvals_self_read" on public.approval_requests for select to authenticated
  using (requester_id = auth.uid() or
    ((public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin')) and tenant_id = public.current_tenant()));
create policy "approvals_self_create" on public.approval_requests for insert to authenticated
  with check (requester_id = auth.uid());
create policy "approvals_manager_decide" on public.approval_requests for update to authenticated
  using ((public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin')) and tenant_id = public.current_tenant());

-- Auto-create profile + default agent role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  _name text := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  _initials text := upper(substring(regexp_replace(_name, '[^a-zA-Z ]', '', 'g'), 1, 2));
begin
  insert into public.profiles (id, name, email, initials, tenant_id)
    values (new.id, _name, new.email, _initials, coalesce(new.raw_user_meta_data->>'tenant_id', 't1'));
  insert into public.user_roles (user_id, role) values (new.id, 'agent');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
