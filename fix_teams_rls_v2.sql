-- Fix RLS policies for teams table
-- Run this in Supabase SQL Editor

-- First, check current policies
SELECT * FROM pg_policies WHERE tablename = 'teams';

-- Drop all existing policies on teams
DROP POLICY IF EXISTS "teams_read_tenant" ON public.teams;
DROP POLICY IF EXISTS "teams_manager_write" ON public.teams;
DROP POLICY IF EXISTS "teams_read_access" ON public.teams;
DROP POLICY IF EXISTS "teams_write_access" ON public.teams;
DROP POLICY IF EXISTS "teams_select_policy" ON public.teams;
DROP POLICY IF EXISTS "teams_all_policy" ON public.teams;

-- Make sure RLS is enabled
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create simple SELECT policy
-- Allow reading teams where:
-- 1. The team's tenant_id matches the user's tenant_id (from profiles)
-- 2. OR the user is a super_admin
CREATE POLICY "teams_select" ON public.teams
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Create ALL policy for managers and super_admins
CREATE POLICY "teams_all" ON public.teams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('manager', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('manager', 'super_admin')
    )
  );

-- Grant permissions
GRANT SELECT ON public.teams TO authenticated;
GRANT INSERT ON public.teams TO authenticated;
GRANT UPDATE ON public.teams TO authenticated;
GRANT DELETE ON public.teams TO authenticated;

-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'teams';
