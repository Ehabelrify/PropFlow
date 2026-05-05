-- Temporary fix: Disable RLS on teams to test if query works
-- Run this in Supabase SQL Editor

-- Disable RLS temporarily
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;

-- Test: This should return all teams
SELECT * FROM public.teams;

-- If the above works, re-enable RLS with a simpler policy:
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on teams
DROP POLICY IF EXISTS "teams_read_tenant" ON public.teams;
DROP POLICY IF EXISTS "teams_manager_write" ON public.teams;
DROP POLICY IF EXISTS "teams_read_access" ON public.teams;
DROP POLICY IF EXISTS "teams_write_access" ON public.teams;
DROP POLICY IF EXISTS "teams_select_policy" ON public.teams;
DROP POLICY IF EXISTS "teams_all_policy" ON public.teams;

-- Create a simple SELECT policy using a subquery instead of current_tenant()
CREATE POLICY "teams_select_policy" ON public.teams
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Create a simple ALL policy for managers and super_admins
CREATE POLICY "teams_all_policy" ON public.teams
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'super_admin'))
  );

-- Test the policy
SELECT * FROM public.teams;
