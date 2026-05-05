-- ============================================================
-- PropFlow CRM: Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Enums
-- ============================================================

create type public.app_role as enum ('super_admin', 'manager', 'leader', 'agent');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.approval_kind as enum ('email', 'password', 'role');

-- CRM enums
create type public.lead_stage as enum ('new', 'contacted', 'qualified', 'viewing', 'negotiation', 'won', 'lost');
create type public.lead_source as enum ('widget', 'manual', 'referral', 'facebook', 'google', 'import');
create type public.task_status as enum ('open', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type public.property_status as enum ('available', 'reserved', 'sold');
create type public.property_type as enum ('apartment', 'villa', 'townhouse', 'office', 'land');
create type public.activity_type as enum ('call', 'note', 'email', 'whatsapp', 'stage_change', 'appointment', 'task');

-- 2. Core Tables (Auth + RBAC)
-- ============================================================

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

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

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

-- 3. CRM Tables
-- ============================================================

create table public.tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan text not null default 'starter' check (plan in ('starter', 'professional', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'suspended', 'trial')),
  seats int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  name text not null,
  leader_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  stage public.lead_stage not null default 'new',
  source public.lead_source not null default 'manual',
  score int not null default 50 check (score between 0 and 100),
  hot boolean not null default false,
  budget numeric not null default 0,
  assigned_to uuid references auth.users(id),
  tenant_id text references public.tenants(id),
  team_id text references public.teams(id),
  property_interest uuid,
  tags text[] not null default '{}',
  notes text,
  requirements jsonb,
  utm_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type public.property_type not null,
  status public.property_status not null default 'available',
  price numeric not null default 0,
  bedrooms int not null default 0,
  bathrooms int not null default 0,
  area numeric not null default 0,
  location text not null,
  developer text,
  image text,
  tenant_id text references public.tenants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fix FK: leads.property_interest needs to reference properties, but properties is defined after leads
-- We handle this with ALTER TABLE after properties exists
alter table public.leads add constraint fk_leads_property_interest foreign key (property_interest) references public.properties(id) on delete set null;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type public.activity_type not null,
  title text not null,
  description text,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_to uuid not null references auth.users(id),
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'open',
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  assigned_to uuid not null references auth.users(id),
  status public.appointment_status not null default 'scheduled',
  scheduled_at timestamptz not null,
  duration_min int not null default 30,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Helper Functions
-- ============================================================

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_tenant()
returns text
language sql stable security definer set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- Auto-create profile + default agent role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  _name text := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  _initials text := upper(substring(regexp_replace(_name, '[^a-zA-Z ]', '', 'g'), 1, 2));
  _tenant_id text := coalesce(new.raw_user_meta_data->>'tenant_id', 't1');
begin
  insert into public.profiles (id, name, email, initials, tenant_id)
    values (new.id, _name, new.email, _initials, _tenant_id);
  insert into public.user_roles (user_id, role) values (new.id, 'agent');
  return new;
end;
$$;

-- 5. Triggers
-- ============================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- 6. Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.approval_requests enable row level security;
alter table public.tenants enable row level security;
alter table public.teams enable row level security;
alter table public.leads enable row level security;
alter table public.properties enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;

-- Profiles policies
create policy "profiles_self_read" on public.profiles for select to authenticated
  using (id = auth.uid() or tenant_id = public.current_tenant() or public.has_role(auth.uid(), 'super_admin'));
create policy "profiles_self_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_manager_update" on public.profiles for update to authenticated
  using ((public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin')) and tenant_id = public.current_tenant());
create policy "profiles_insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

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

-- Tenants policies
create policy "tenants_read_own" on public.tenants for select to authenticated
  using (id = public.current_tenant() or public.has_role(auth.uid(), 'super_admin'));
create policy "tenants_super_admin_all" on public.tenants for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Teams policies
create policy "teams_read_tenant" on public.teams for select to authenticated
  using (tenant_id = public.current_tenant() or public.has_role(auth.uid(), 'super_admin'));
create policy "teams_manager_write" on public.teams for all to authenticated
  using (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'));

-- Leads policies (tenant-scoped)
create policy "leads_read_scope" on public.leads for select to authenticated
  using (
    tenant_id = public.current_tenant() or public.has_role(auth.uid(), 'super_admin')
  );
create policy "leads_create" on public.leads for insert to authenticated
  with check (tenant_id = public.current_tenant() or public.has_role(auth.uid(), 'super_admin'));
create policy "leads_update_own_or_manager" on public.leads for update to authenticated
  using (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin') or
    public.has_role(auth.uid(), 'leader')
  )
  with check (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin') or
    public.has_role(auth.uid(), 'leader')
  );
create policy "leads_delete_manager" on public.leads for delete to authenticated
  using (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'));

-- Properties policies
create policy "properties_read_tenant" on public.properties for select to authenticated
  using (tenant_id = public.current_tenant() or tenant_id is null or public.has_role(auth.uid(), 'super_admin'));
create policy "properties_write_manager" on public.properties for all to authenticated
  using (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'super_admin'));

-- Activities policies
create policy "activities_read_lead_scope" on public.activities for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and (l.tenant_id = public.current_tenant() or public.has_role(auth.uid(), 'super_admin'))
    )
  );
create policy "activities_create" on public.activities for insert to authenticated
  with check (user_id = auth.uid());

-- Tasks policies
create policy "tasks_read_assigned_or_lead_scope" on public.tasks for select to authenticated
  using (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin') or
    public.has_role(auth.uid(), 'leader') or
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.assigned_to = auth.uid()
    )
  );
create policy "tasks_write" on public.tasks for all to authenticated
  using (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin')
  )
  with check (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin')
  );

-- Appointments policies
create policy "appointments_read_assigned_or_lead_scope" on public.appointments for select to authenticated
  using (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin') or
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.assigned_to = auth.uid()
    )
  );
create policy "appointments_write" on public.appointments for all to authenticated
  using (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin')
  )
  with check (
    assigned_to = auth.uid() or
    public.has_role(auth.uid(), 'manager') or
    public.has_role(auth.uid(), 'super_admin')
  );

-- 7. Function permissions
-- ============================================================

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.current_tenant() from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.current_tenant() to authenticated;

-- 8. Seed data
-- ============================================================

-- Insert default tenant
insert into public.tenants (id, name, slug, plan, status, seats) values
  ('t1', 'Acme Realty Group', 'acme-realty', 'professional', 'active', 25)
on conflict (id) do nothing;

-- Insert default teams
insert into public.teams (id, tenant_id, name) values
  ('tm1', 't1', 'Residential Sales'),
  ('tm2', 't1', 'Commercial & Investment')
on conflict (id) do nothing;
