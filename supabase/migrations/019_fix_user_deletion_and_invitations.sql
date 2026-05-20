-- 019: Fix user deletion, invitation roles, and super admin RLS
-- 
-- Changes:
-- 1. Fix FK constraints that block user deletion (activities, teams, approval_requests)
-- 2. Add role column to invitations for storing intended role
-- 3. Update redeem_invitation to assign the stored role
-- 4. Ensure super admin bypasses RLS for all operations

-- ============================================================
-- PART 1: Fix FK constraints that block user deletion
-- ============================================================

-- activities.user_id: make nullable + SET NULL on delete
alter table public.activities
  drop constraint if exists activities_user_id_fkey,
  add constraint activities_user_id_fkey
    foreign key (user_id) references auth.users(id)
    on delete set null;
alter table public.activities alter column user_id drop not null;

-- teams.leader_id: SET NULL on delete (already nullable)
alter table public.teams
  drop constraint if exists teams_leader_id_fkey,
  add constraint teams_leader_id_fkey
    foreign key (leader_id) references auth.users(id)
    on delete set null;

-- approval_requests.decided_by: SET NULL on delete (already nullable)
alter table public.approval_requests
  drop constraint if exists approval_requests_decided_by_fkey,
  add constraint approval_requests_decided_by_fkey
    foreign key (decided_by) references auth.users(id)
    on delete set null;

-- ============================================================
-- PART 2: Add role column to invitations
-- ============================================================

alter table public.invitations
  add column if not exists role text not null default 'agent'
  check (role in ('agent', 'manager', 'leader'));

-- ============================================================
-- PART 3: Update redeem_invitation to assign stored role
-- ============================================================

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

  -- Check seat capacity
  select count(*) into v_profile_count
  from public.profiles
  where tenant_id = v_invitation.tenant_id;

  if v_profile_count >= v_invitation.seats then
    raise exception 'Workspace is at full capacity (%)', v_invitation.seats;
  end if;

  -- Assign user to tenant/team
  update public.profiles
  set tenant_id = v_invitation.tenant_id,
      team_id = v_invitation.team_id,
      updated_at = now()
  where id = _user_id;

  -- Assign role from invitation (remove any default agent role first)
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, v_invitation.role::public.app_role);

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

grant execute on function public.redeem_invitation(text, uuid) to authenticated;

-- Also update handle_user_deletion to handle activities cleanup
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
-- PART 4: Ensure super admin RLS bypass is comprehensive
-- ============================================================

-- Ensure super_admin can see all leads
drop policy if exists "super_admin_full_access_leads" on public.leads;
create policy "super_admin_full_access_leads" on public.leads
  for all using (public.is_super_admin());

-- Ensure super_admin can see all profiles
drop policy if exists "super_admin_full_access_profiles" on public.profiles;
create policy "super_admin_full_access_profiles" on public.profiles
  for all using (public.is_super_admin());

-- Ensure super_admin can see all teams
drop policy if exists "super_admin_full_access_teams" on public.teams;
create policy "super_admin_full_access_teams" on public.teams
  for all using (public.is_super_admin());

-- Ensure super_admin can see all activities
drop policy if exists "super_admin_full_access_activities" on public.activities;
create policy "super_admin_full_access_activities" on public.activities
  for all using (public.is_super_admin());

-- Ensure super_admin can see all tasks
drop policy if exists "super_admin_full_access_tasks" on public.tasks;
create policy "super_admin_full_access_tasks" on public.tasks
  for all using (public.is_super_admin());

-- Ensure super_admin can see all appointments
drop policy if exists "super_admin_full_access_appointments" on public.appointments;
create policy "super_admin_full_access_appointments" on public.appointments
  for all using (public.is_super_admin());

-- Ensure super_admin can see all properties
drop policy if exists "super_admin_full_access_properties" on public.properties;
create policy "super_admin_full_access_properties" on public.properties
  for all using (public.is_super_admin());

-- Ensure super_admin can see all invitations
drop policy if exists "super_admin_full_access_invitations" on public.invitations;
create policy "super_admin_full_access_invitations" on public.invitations
  for all using (public.is_super_admin());
