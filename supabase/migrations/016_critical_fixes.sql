-- ============================================================
-- Migration 016: Critical Security & Stability Fixes
-- Addresses: Issues #1, #2, #3 (partial), #5, #6, #7
-- ============================================================

-- ISSUE #1: Add missing used_by and used_at columns to invitations
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- ISSUE #5: Drop stale tenant-wide RLS policies that bypass team isolation
-- These were created in 002/003 and conflict with team-scoped policies in 010

-- Activities stale policies (from 002)
DROP POLICY IF EXISTS "Activities are viewable by tenant members" ON public.activities;
DROP POLICY IF EXISTS "Activities can be inserted by tenant members" ON public.activities;
DROP POLICY IF EXISTS "Activities can be updated by tenant members" ON public.activities;
DROP POLICY IF EXISTS "Activities can be deleted by tenant members" ON public.activities;

-- Appointments stale policies (from 002)
DROP POLICY IF EXISTS "Appointments are viewable by tenant members" ON public.appointments;
DROP POLICY IF EXISTS "Appointments can be inserted by tenant members" ON public.appointments;
DROP POLICY IF EXISTS "Appointments can be updated by tenant members" ON public.appointments;
DROP POLICY IF EXISTS "Appointments can be deleted by tenant members" ON public.appointments;

-- Tasks stale policies (from 002)
DROP POLICY IF EXISTS "Tasks are viewable by tenant members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks can be inserted by tenant members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks can be updated by tenant members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks can be deleted by tenant members" ON public.tasks;

-- Now add proper UPDATE/DELETE policies for activities (missing from migration 010)
-- These should follow the same team-scoped pattern as SELECT

-- ISSUE #40: Add UPDATE/DELETE policies for activities
-- UPDATE: Super admins can update any activity
CREATE POLICY "activities_super_admin_write" ON public.activities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- UPDATE: Tenant managers can update activities for their tenant's leads
CREATE POLICY "activities_tenant_manager_write" ON public.activities
  FOR ALL TO authenticated
  USING (
    public.is_tenant_manager()
    AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = activities.lead_id AND l.tenant_id = public.current_tenant()
    )
  )
  WITH CHECK (
    public.is_tenant_manager()
    AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = activities.lead_id AND l.tenant_id = public.current_tenant()
    )
  );

-- UPDATE: Team leaders can update activities for their team's leads
CREATE POLICY "activities_team_leader_write" ON public.activities
  FOR ALL TO authenticated
  USING (
    public.is_team_leader()
    AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = activities.lead_id AND l.team_id = public.current_user_team_id() AND l.tenant_id = public.current_tenant()
    )
  )
  WITH CHECK (
    public.is_team_leader()
    AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = activities.lead_id AND l.team_id = public.current_user_team_id() AND l.tenant_id = public.current_tenant()
    )
  );

-- UPDATE: Agents can update their own activities
CREATE POLICY "activities_agent_write" ON public.activities
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ISSUE #6: Add tenant isolation to leads_delete_manager policy
-- Drop the existing policy without tenant check
DROP POLICY IF EXISTS "leads_delete_manager" ON public.leads;

-- Recreate with tenant isolation
CREATE POLICY "leads_delete_manager" ON public.leads
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'manager') AND tenant_id = public.current_tenant())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ISSUE #2: Fix handle_user_deletion trigger to use profiles instead of auth.users
-- The current trigger fires on auth.users and references OLD.tenant_id which doesn't exist

-- First drop the broken trigger
DROP TRIGGER IF EXISTS handle_user_deletion_trigger ON auth.users;

-- Create a corrected trigger on profiles instead (which has tenant_id)
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER AS $$
DECLARE
  tenant_manager_id UUID;
  affected_leads_count INTEGER;
  affected_tasks_count INTEGER;
  affected_appointments_count INTEGER;
  v_tenant_id TEXT;
BEGIN
  -- Get tenant_id from the profile being deleted
  v_tenant_id := OLD.tenant_id;

  IF v_tenant_id IS NULL THEN
    -- User has no tenant, nothing to reassign
    RETURN OLD;
  END IF;

  -- Find a manager in the same tenant to reassign to
  SELECT p.id INTO tenant_manager_id
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  WHERE p.tenant_id = v_tenant_id
    AND ur.role IN ('manager', 'super_admin')
    AND p.id != OLD.id
  LIMIT 1;

  -- If no manager found, find any user in the tenant
  IF tenant_manager_id IS NULL THEN
    SELECT id INTO tenant_manager_id
    FROM profiles
    WHERE tenant_id = v_tenant_id
      AND id != OLD.id
    LIMIT 1;
  END IF;

  -- If a reassignment target is found, reassign records
  IF tenant_manager_id IS NOT NULL THEN
    -- Reassign leads
    UPDATE leads
    SET
      assigned_to = tenant_manager_id,
      updated_at = NOW()
    WHERE assigned_to = OLD.id;

    GET DIAGNOSTICS affected_leads_count = ROW_COUNT;

    -- Reassign tasks
    UPDATE tasks
    SET
      assigned_to = tenant_manager_id,
      updated_at = NOW()
    WHERE assigned_to = OLD.id;

    GET DIAGNOSTICS affected_tasks_count = ROW_COUNT;

    -- Reassign appointments
    UPDATE appointments
    SET
      assigned_to = tenant_manager_id,
      updated_at = NOW()
    WHERE assigned_to = OLD.id;

    GET DIAGNOSTICS affected_appointments_count = ROW_COUNT;

    RAISE NOTICE 'User % deleted. Reassigned % leads, % tasks, and % appointments to user %',
      OLD.email, affected_leads_count, affected_tasks_count, affected_appointments_count, tenant_manager_id;
  ELSE
    RAISE NOTICE 'User % deleted. No other users in tenant to reassign to.', OLD.email;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles instead of auth.users
-- Note: profiles has ON DELETE CASCADE from auth.users, so this fires before cascade
CREATE TRIGGER handle_user_deletion_trigger
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_deletion();

-- ISSUE #7: Add SECURITY DEFINER to check_lead_duplicate trigger function
-- Recreate the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_lead_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duplicate_count INTEGER;
  duplicate_lead_id UUID;
BEGIN
  -- Only check for new leads or when email/phone changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.email != OLD.email OR NEW.phone != OLD.phone)) THEN

    -- Check for exact email match within tenant
    SELECT COUNT(*), MAX(id) INTO duplicate_count, duplicate_lead_id
    FROM leads
    WHERE
      tenant_id = NEW.tenant_id
      AND LOWER(email) = LOWER(NEW.email)
      AND id != NEW.id;

    IF duplicate_count > 0 THEN
      RAISE NOTICE 'Duplicate lead detected: email % already exists for tenant %', NEW.email, NEW.tenant_id;

      -- For INSERT, prevent the duplicate
      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Duplicate lead: A lead with email % already exists in this workspace', NEW.email
          USING HINT = 'Check existing leads before creating new ones',
                ERRCODE = '23505'; -- unique_violation
      END IF;
    END IF;

    -- Check for phone duplicates (warning only, not blocking)
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
      SELECT COUNT(*) INTO duplicate_count
      FROM leads
      WHERE
        tenant_id = NEW.tenant_id
        AND phone = NEW.phone
        AND id != NEW.id;

      IF duplicate_count > 0 THEN
        RAISE NOTICE 'Potential duplicate: phone % already exists for tenant %', NEW.phone, NEW.tenant_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Made with Bob
