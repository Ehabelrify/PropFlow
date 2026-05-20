-- ============================================================
-- PropFlow CRM: Reconciliation Migration
-- 
-- This migration reconciles the remote database state with:
-- 1. Un-applied migrations (005-017) 
-- 2. SQL editor additions (is_super_admin, super_admin_full_access_*)
-- 3. Fixes broken SQL editor modifications (redeem_invitation)
-- ============================================================

-- ============================================================
-- PART 1: Fix broken SQL editor changes
-- ============================================================

-- 1A: Drop broken redeem_invitation (references used_by/used_at 
-- and activities.metadata which don't exist)
-- Replaced fully later in this migration
drop function if exists public.redeem_invitation(text, uuid);

-- ============================================================
-- PART 2: Add missing columns (from 016, 007, 012)
-- ============================================================

-- Add used_by and used_at to invitations (from 016)
alter table public.invitations add column if not exists used_by uuid references auth.users(id) on delete set null;
alter table public.invitations add column if not exists used_at timestamptz;

-- ============================================================
-- PART 3: Add missing constraints (from 012, 015, 002/003)
-- ============================================================

-- Add constraint to tenant status CHECK (includes pending_approval, rejected)
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check 
  check (status in ('active', 'suspended', 'trial', 'pending_approval', 'rejected'));

-- ============================================================
-- PART 4: Missing triggers (from 013, 014, 015, 016)
-- ============================================================

-- 4A: Recalculate score on lead update (from 013, updated by 017)
drop trigger if exists recalculate_lead_score_on_update on public.leads;
create trigger recalculate_lead_score_on_update
  after update of stage, budget, requirements, notes, property_interest, last_activity_at, assigned_to
  on public.leads
  for each row
  execute function public.trigger_recalculate_lead_score();

-- 4B: Move handle_user_deletion from auth.users to profiles (from 016)
drop trigger if exists handle_user_deletion_trigger on auth.users;
drop trigger if exists handle_user_deletion_trigger on public.profiles;
create trigger handle_user_deletion_trigger
  before delete on public.profiles
  for each row
  execute function public.handle_user_deletion();

-- 4C: Duplicate lead check (from 014) - already exists, just fix SECURITY DEFINER
-- Note: We repalce the function below

-- ============================================================
-- PART 5: Fix function signatures and definitions
-- ============================================================

-- 5A: check_lead_duplicate - add SECURITY DEFINER (from 016)
create or replace function public.check_lead_duplicate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  duplicate_count integer;
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (new.email != old.email or new.phone != old.phone)) then
    select count(*)
    into duplicate_count
    from public.leads
    where tenant_id = new.tenant_id
      and lower(email) = lower(new.email)
      and id != new.id;
    if duplicate_count > 0 then
      raise notice 'Duplicate lead detected: email % already exists for tenant %', new.email, new.tenant_id;
      if tg_op = 'INSERT' then
        raise exception 'Duplicate lead: A lead with email % already exists in this workspace', new.email
          using hint = 'Check existing leads before creating new ones',
                errcode = '23505';
      end if;
      if tg_op = 'UPDATE' and new.id = old.id then
        return new;
      end if;
    end if;
    if new.phone is not null and new.phone != '' then
      select count(*)
      into duplicate_count
      from public.leads
      where tenant_id = new.tenant_id
        and phone = new.phone
        and id != new.id;
      if duplicate_count > 0 then
        raise notice 'Potential duplicate: phone % already exists for tenant %', new.phone, new.tenant_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 5B: find_duplicate_leads - fix param type TEXT (from 017)
drop function if exists public.find_duplicate_leads(text, text, uuid, uuid);
create or replace function public.find_duplicate_leads(
  p_email text default null,
  p_phone text default null,
  p_tenant_id text default null,
  p_exclude_lead_id uuid default null
)
returns table(
  id uuid, name text, email text, phone text, stage text,
  created_at timestamptz, match_type text, confidence integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with email_matches as (
    select l.id, l.name, l.email, l.phone, l.stage::text, l.created_at,
           'exact_email'::text as match_type, 100 as confidence
    from public.leads l
    where l.tenant_id = p_tenant_id
      and l.email is not null and l.email = p_email
      and (p_exclude_lead_id is null or l.id != p_exclude_lead_id)
  ),
  phone_matches as (
    select l.id, l.name, l.email, l.phone, l.stage::text, l.created_at,
           'exact_phone'::text as match_type, 90 as confidence
    from public.leads l
    where l.tenant_id = p_tenant_id
      and l.phone is not null and l.phone != '' and l.phone = p_phone
      and (p_exclude_lead_id is null or l.id != p_exclude_lead_id)
  )
  select * from email_matches
  union
  select * from phone_matches
  order by confidence desc, created_at desc
  limit 10;
end;
$$;

-- 5C: Rebuild redeem_invitation from migration 017 (with seat check)
-- This version fixes the broken SQL editor version
create or replace function public.redeem_invitation(_code text, _user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
  v_tenant_record record;
  v_profile_count integer;
  v_result jsonb;
begin
  if _code is null or _code = '' then
    raise exception 'Invitation code is required';
  end if;
  if _code !~ '^[A-Z0-9]{6}$' then
    raise exception 'Invalid invitation code format';
  end if;
  if _user_id is null then
    raise exception 'User ID is required';
  end if;

  -- Find and lock invitation
  select i.*, t.name as tenant_name, t.status as tenant_status, t.seats
  into v_invitation
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.code = _code
    and i.is_active = true
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invitation code';
  end if;

  -- Check if already in a different tenant
  if exists (select 1 from public.profiles where id = _user_id and tenant_id is not null and tenant_id != v_invitation.tenant_id) then
    raise exception 'User already belongs to another workspace';
  end if;

  -- Check tenant is active
  if v_invitation.tenant_status != 'active' then
    raise exception 'Workspace is not active';
  end if;

  -- Check seat capacity (restored from 007, dropped in 012)
  select count(*) into v_profile_count
  from public.profiles
  where tenant_id = v_invitation.tenant_id;

  if v_profile_count >= v_invitation.seats then
    raise exception 'Workspace is at full capacity (% seats)', v_invitation.seats;
  end if;

  -- Assign user
  update public.profiles
  set tenant_id = v_invitation.tenant_id,
      team_id = v_invitation.team_id,
      updated_at = now()
  where id = _user_id;

  -- Assign agent role if not already assigned
  if not exists (select 1 from public.user_roles where user_id = _user_id) then
    insert into public.user_roles (user_id, role) values (_user_id, 'agent');
  end if;

  -- Mark invitation as used
  update public.invitations
  set is_active = false,
      used_by = _user_id,
      used_at = now()
  where id = v_invitation.id;

  v_result := jsonb_build_object(
    'success', true,
    'tenant_id', v_invitation.tenant_id,
    'team_id', v_invitation.team_id,
    'tenant_name', v_invitation.tenant_name,
    'message', 'Successfully joined workspace'
  );

  return v_result;
exception
  when others then
    raise notice 'Error redeeming invitation: %', sqlerrm;
    raise;
end;
$$;

-- 5D: handle_user_deletion - already updated to work on profiles (from 016)
-- Rewrite to handle profiles deletion safely
create or replace function public.handle_user_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id text;
  v_new_owner_id uuid;
begin
  v_tenant_id := old.tenant_id;

  if v_tenant_id is null then
    return old;
  end if;

  -- Find a manager or any user in the same tenant to reassign
  select user_id into v_new_owner_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where p.tenant_id = v_tenant_id
    and ur.user_id != old.id
    and ur.role in ('manager', 'super_admin')
  limit 1;

  if v_new_owner_id is null then
    select p.id into v_new_owner_id
    from public.profiles p
    where p.tenant_id = v_tenant_id
      and p.id != old.id
    limit 1;
  end if;

  if v_new_owner_id is not null then
    update public.leads set assigned_to = v_new_owner_id, updated_at = now()
    where assigned_to = old.id;
    update public.tasks set assigned_to = v_new_owner_id
    where assigned_to = old.id;
    update public.appointments set assigned_to = v_new_owner_id
    where assigned_to = old.id;
  end if;

  return old;
end;
$$;

-- ============================================================
-- PART 6: RLS Policy reconciliation
-- ============================================================

-- 6A: Drop stale team-wide policies from 002 (should have been cleaned by 010/016)
do $$
begin
  -- Activities
  drop policy if exists "Activities are viewable by tenant members" on public.activities;
  drop policy if exists "Activities can be inserted by tenant members" on public.activities;
  drop policy if exists "Activities can be updated by tenant members" on public.activities;
  drop policy if exists "Activities can be deleted by tenant members" on public.activities;

  -- Tasks
  drop policy if exists "Tasks are viewable by tenant members" on public.tasks;
  drop policy if exists "Tasks can be inserted by tenant members" on public.tasks;
  drop policy if exists "Tasks can be updated by tenant members" on public.tasks;
  drop policy if exists "Tasks can be deleted by tenant members" on public.tasks;

  -- Appointments
  drop policy if exists "Appointments are viewable by tenant members" on public.appointments;
  drop policy if exists "Appointments can be inserted by tenant members" on public.appointments;
  drop policy if exists "Appointments can be updated by tenant members" on public.appointments;
  drop policy if exists "Appointments can be deleted by tenant members" on public.appointments;

  -- Rename password_reset_attempts policy (from 017)
  drop policy if exists "System only access" on public.password_reset_attempts;
end $$;

create policy "password_reset_attempts_system_access" on public.password_reset_attempts
  for all to authenticated
  using (false)
  with check (false);

-- 6B: Add team-scoped RLS for activities (from 010, enhanced by 016)
drop policy if exists "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert to authenticated
  with check (
    (user_id = auth.uid())
    and exists (
      select 1 from public.leads l
      where l.id = lead_id
        and (
          l.assigned_to = auth.uid()
          or public.has_role(auth.uid(), 'manager')
          or public.has_role(auth.uid(), 'super_admin')
          or (public.is_team_leader() and l.team_id = public.current_user_team_id())
        )
    )
  );

-- 6C: Activities UPDATE/DELETE policies (from 016)
drop policy if exists "activities_super_admin_write" on public.activities;
create policy "activities_super_admin_write" on public.activities
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "activities_tenant_manager_write" on public.activities;
create policy "activities_tenant_manager_write" on public.activities
  for all to authenticated
  using (
    public.is_tenant_manager()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.tenant_id = public.current_tenant()
    )
  )
  with check (
    public.is_tenant_manager()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.tenant_id = public.current_tenant()
    )
  );

drop policy if exists "activities_team_leader_write" on public.activities;
create policy "activities_team_leader_write" on public.activities
  for all to authenticated
  using (
    public.is_team_leader()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.team_id = public.current_user_team_id()
    )
  )
  with check (
    public.is_team_leader()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.team_id = public.current_user_team_id()
    )
  );

drop policy if exists "activities_agent_write" on public.activities;
create policy "activities_agent_write" on public.activities
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 6D: leads_delete_manager with tenant isolation (from 016)
drop policy if exists "leads_delete_manager" on public.leads;
create policy "leads_delete_manager" on public.leads
  for delete to authenticated
  using (
    (public.has_role(auth.uid(), 'manager') and tenant_id = public.current_tenant())
    or public.has_role(auth.uid(), 'super_admin')
  );

-- ============================================================
-- PART 7: Preserve SQL Editor additions
-- ============================================================

-- 7A: is_super_admin function (used by super_admin_full_access_* policies)
create or replace function public.is_super_admin()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role = 'super_admin'
  );
$$;

-- 7B: Grant proper permissions
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

grant execute on function public.find_duplicate_leads(text, text, text, uuid) to authenticated;
grant execute on function public.merge_duplicate_leads(uuid, uuid, uuid) to authenticated;
grant execute on function public.validate_invitation_code(text) to authenticated;
grant execute on function public.cleanup_expired_invitations() to authenticated;

-- ============================================================
-- PART 8: Verify state
-- ============================================================

do $$
begin
  raise notice 'Reconciliation migration 018 applied successfully';
end $$;
