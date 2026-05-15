-- ============================================================
-- Migration 010: Enhanced RLS Team-Based Filtering
-- Critical Security Fix: Prevent data leakage between teams
-- ============================================================

-- Drop existing policies that need enhancement
DROP POLICY IF EXISTS "leads_read_scope" ON public.leads;
DROP POLICY IF EXISTS "leads_create" ON public.leads;
DROP POLICY IF EXISTS "leads_update_own_or_manager" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_manager" ON public.leads;
DROP POLICY IF EXISTS "tasks_read_assigned_or_lead_scope" ON public.tasks;
DROP POLICY IF EXISTS "tasks_write" ON public.tasks;
DROP POLICY IF EXISTS "activities_read_lead_scope" ON public.activities;
DROP POLICY IF EXISTS "activities_create" ON public.activities;
DROP POLICY IF EXISTS "appointments_read_assigned_or_lead_scope" ON public.appointments;
DROP POLICY IF EXISTS "appointments_write" ON public.appointments;

-- ============================================================
-- Helper Functions for Team-Based Access Control
-- ============================================================

-- Get current user's team_id
CREATE OR REPLACE FUNCTION public.current_user_team_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if user is a team leader (has leader or manager role AND has a team_id)
CREATE OR REPLACE FUNCTION public.is_team_leader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid()
    AND ur.role IN ('leader', 'manager')
    AND p.team_id IS NOT NULL
  );
$$;

-- Check if user is a tenant-level manager (manager role WITHOUT team_id)
CREATE OR REPLACE FUNCTION public.is_tenant_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid()
    AND ur.role = 'manager'
    AND p.team_id IS NULL
  );
$$;

-- ============================================================
-- LEADS TABLE - Enhanced Team-Based RLS Policies
-- ============================================================

-- Super admins see all leads across all tenants
CREATE POLICY "leads_super_admin_all"
ON public.leads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
);

-- Tenant-level managers see all leads in their tenant (no team restriction)
CREATE POLICY "leads_tenant_manager_all"
ON public.leads
FOR SELECT
TO authenticated
USING (
  public.is_tenant_manager()
  AND tenant_id = public.current_tenant()
);

-- Team leaders see only leads from their team
CREATE POLICY "leads_team_leader_team_only"
ON public.leads
FOR SELECT
TO authenticated
USING (
  public.is_team_leader()
  AND team_id = public.current_user_team_id()
  AND tenant_id = public.current_tenant()
);

-- Agents see only leads assigned to them
CREATE POLICY "leads_agent_assigned_only"
ON public.leads
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  AND tenant_id = public.current_tenant()
);

-- INSERT: Users can create leads in their tenant
CREATE POLICY "leads_insert_tenant"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant()
  OR public.has_role(auth.uid(), 'super_admin')
);

-- UPDATE: Super admins can update any lead
CREATE POLICY "leads_update_super_admin"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- UPDATE: Tenant managers can update any lead in their tenant
CREATE POLICY "leads_update_tenant_manager"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  public.is_tenant_manager()
  AND tenant_id = public.current_tenant()
)
WITH CHECK (
  public.is_tenant_manager()
  AND tenant_id = public.current_tenant()
);

-- UPDATE: Team leaders can update leads in their team
CREATE POLICY "leads_update_team_leader"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  public.is_team_leader()
  AND team_id = public.current_user_team_id()
  AND tenant_id = public.current_tenant()
)
WITH CHECK (
  public.is_team_leader()
  AND team_id = public.current_user_team_id()
  AND tenant_id = public.current_tenant()
);

-- UPDATE: Agents can update their assigned leads
CREATE POLICY "leads_update_agent_assigned"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  AND tenant_id = public.current_tenant()
)
WITH CHECK (
  assigned_to = auth.uid()
  AND tenant_id = public.current_tenant()
);

-- DELETE: Only managers and super admins can delete leads
CREATE POLICY "leads_delete_manager"
ON public.leads
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- ============================================================
-- TASKS TABLE - Enhanced Team-Based RLS Policies
-- ============================================================

-- SELECT: Super admins see all tasks
CREATE POLICY "tasks_super_admin_all"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
);

-- SELECT: Tenant managers see all tasks for leads in their tenant
CREATE POLICY "tasks_tenant_manager_all"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.is_tenant_manager()
  AND (
    lead_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tasks.lead_id
      AND l.tenant_id = public.current_tenant()
    )
  )
);

-- SELECT: Team leaders see tasks for leads in their team
CREATE POLICY "tasks_team_leader_team_only"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.is_team_leader()
  AND (
    -- Tasks assigned to them
    assigned_to = auth.uid()
    OR
    -- Tasks for leads in their team
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tasks.lead_id
      AND l.team_id = public.current_user_team_id()
      AND l.tenant_id = public.current_tenant()
    )
  )
);

-- SELECT: Agents see tasks assigned to them or for their assigned leads
CREATE POLICY "tasks_agent_assigned"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = tasks.lead_id
    AND l.assigned_to = auth.uid()
  )
);

-- INSERT/UPDATE/DELETE: Super admins have full access
CREATE POLICY "tasks_super_admin_write"
ON public.tasks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- INSERT/UPDATE/DELETE: Tenant managers have full access to tenant tasks
CREATE POLICY "tasks_tenant_manager_write"
ON public.tasks
FOR ALL
TO authenticated
USING (
  public.is_tenant_manager()
  AND (
    lead_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tasks.lead_id
      AND l.tenant_id = public.current_tenant()
    )
  )
)
WITH CHECK (
  public.is_tenant_manager()
  AND (
    lead_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tasks.lead_id
      AND l.tenant_id = public.current_tenant()
    )
  )
);

-- INSERT/UPDATE/DELETE: Team leaders can manage tasks for their team's leads
CREATE POLICY "tasks_team_leader_write"
ON public.tasks
FOR ALL
TO authenticated
USING (
  public.is_team_leader()
  AND (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tasks.lead_id
      AND l.team_id = public.current_user_team_id()
    )
  )
)
WITH CHECK (
  public.is_team_leader()
  AND (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = tasks.lead_id
      AND l.team_id = public.current_user_team_id()
    )
  )
);

-- INSERT/UPDATE/DELETE: Agents can manage their own tasks
CREATE POLICY "tasks_agent_write"
ON public.tasks
FOR ALL
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- ============================================================
-- ACTIVITIES TABLE - Enhanced Team-Based RLS Policies
-- ============================================================

-- SELECT: Super admins see all activities
CREATE POLICY "activities_super_admin_all"
ON public.activities
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
);

-- SELECT: Tenant managers see all activities for leads in their tenant
CREATE POLICY "activities_tenant_manager_all"
ON public.activities
FOR SELECT
TO authenticated
USING (
  public.is_tenant_manager()
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = activities.lead_id
    AND l.tenant_id = public.current_tenant()
  )
);

-- SELECT: Team leaders see activities for leads in their team
CREATE POLICY "activities_team_leader_team_only"
ON public.activities
FOR SELECT
TO authenticated
USING (
  public.is_team_leader()
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = activities.lead_id
    AND l.team_id = public.current_user_team_id()
    AND l.tenant_id = public.current_tenant()
  )
);

-- SELECT: Agents see activities for their assigned leads
CREATE POLICY "activities_agent_assigned"
ON public.activities
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = activities.lead_id
    AND l.assigned_to = auth.uid()
  )
);

-- INSERT: Users can create activities for leads they can access
CREATE POLICY "activities_insert"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR
    -- Tenant manager can create for any tenant lead
    (
      public.is_tenant_manager()
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = activities.lead_id
        AND l.tenant_id = public.current_tenant()
      )
    )
    OR
    -- Team leader can create for team leads
    (
      public.is_team_leader()
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = activities.lead_id
        AND l.team_id = public.current_user_team_id()
      )
    )
    OR
    -- Agent can create for assigned leads
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = activities.lead_id
      AND l.assigned_to = auth.uid()
    )
  )
);

-- ============================================================
-- APPOINTMENTS TABLE - Enhanced Team-Based RLS Policies
-- ============================================================

-- SELECT: Super admins see all appointments
CREATE POLICY "appointments_super_admin_all"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
);

-- SELECT: Tenant managers see all appointments for leads in their tenant
CREATE POLICY "appointments_tenant_manager_all"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  public.is_tenant_manager()
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = appointments.lead_id
    AND l.tenant_id = public.current_tenant()
  )
);

-- SELECT: Team leaders see appointments for leads in their team
CREATE POLICY "appointments_team_leader_team_only"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  public.is_team_leader()
  AND (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = appointments.lead_id
      AND l.team_id = public.current_user_team_id()
      AND l.tenant_id = public.current_tenant()
    )
  )
);

-- SELECT: Agents see appointments assigned to them or for their leads
CREATE POLICY "appointments_agent_assigned"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = appointments.lead_id
    AND l.assigned_to = auth.uid()
  )
);

-- INSERT/UPDATE/DELETE: Super admins have full access
CREATE POLICY "appointments_super_admin_write"
ON public.appointments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- INSERT/UPDATE/DELETE: Tenant managers have full access to tenant appointments
CREATE POLICY "appointments_tenant_manager_write"
ON public.appointments
FOR ALL
TO authenticated
USING (
  public.is_tenant_manager()
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = appointments.lead_id
    AND l.tenant_id = public.current_tenant()
  )
)
WITH CHECK (
  public.is_tenant_manager()
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = appointments.lead_id
    AND l.tenant_id = public.current_tenant()
  )
);

-- INSERT/UPDATE/DELETE: Team leaders can manage appointments for their team
CREATE POLICY "appointments_team_leader_write"
ON public.appointments
FOR ALL
TO authenticated
USING (
  public.is_team_leader()
  AND (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = appointments.lead_id
      AND l.team_id = public.current_user_team_id()
    )
  )
)
WITH CHECK (
  public.is_team_leader()
  AND (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = appointments.lead_id
      AND l.team_id = public.current_user_team_id()
    )
  )
);

-- INSERT/UPDATE/DELETE: Agents can manage their own appointments
CREATE POLICY "appointments_agent_write"
ON public.appointments
FOR ALL
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- ============================================================
-- Grant Execute Permissions on Helper Functions
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.current_user_team_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_leader() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_manager() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.current_user_team_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_leader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_manager() TO authenticated;

-- ============================================================
-- Migration Complete
-- ============================================================
-- This migration enhances RLS policies to enforce team-based filtering
-- preventing data leakage between teams within the same tenant.
--
-- Key Changes:
-- 1. Added helper functions for team-based access control
-- 2. Separated policies for super_admin, tenant managers, team leaders, and agents
-- 3. Team leaders can only see data from their specific team
-- 4. Agents can only see data assigned to them
-- 5. Tenant managers (without team_id) can see all tenant data
-- 6. All policies enforce both tenant_id AND team_id where applicable

-- Made with Bob
