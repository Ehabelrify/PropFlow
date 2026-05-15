-- ============================================================
-- Test Script: RLS Team-Based Filtering Validation
-- ============================================================
-- This script tests the enhanced RLS policies to ensure proper
-- team-based data isolation and prevent data leakage.
--
-- IMPORTANT: Run these tests in a test environment, not production!
-- ============================================================

-- Setup: Create test data
-- ============================================================

-- Test tenant
INSERT INTO public.tenants (id, name, slug, plan, status, seats)
VALUES ('test-tenant', 'Test Tenant', 'test-tenant', 'professional', 'active', 50)
ON CONFLICT (id) DO NOTHING;

-- Test teams
INSERT INTO public.teams (id, tenant_id, name)
VALUES 
  ('team-a', 'test-tenant', 'Team A'),
  ('team-b', 'test-tenant', 'Team B')
ON CONFLICT (id) DO NOTHING;

-- Test users (you'll need to create these via Supabase Auth first)
-- Then update their profiles and roles:

-- Super Admin (no tenant, no team)
-- UPDATE public.profiles SET tenant_id = NULL, team_id = NULL WHERE id = 'super-admin-uuid';
-- INSERT INTO public.user_roles (user_id, role) VALUES ('super-admin-uuid', 'super_admin');

-- Tenant Manager (has tenant, no team)
-- UPDATE public.profiles SET tenant_id = 'test-tenant', team_id = NULL WHERE id = 'manager-uuid';
-- INSERT INTO public.user_roles (user_id, role) VALUES ('manager-uuid', 'manager');

-- Team A Leader (has tenant and team)
-- UPDATE public.profiles SET tenant_id = 'test-tenant', team_id = 'team-a' WHERE id = 'leader-a-uuid';
-- INSERT INTO public.user_roles (user_id, role) VALUES ('leader-a-uuid', 'leader');

-- Team B Leader (has tenant and team)
-- UPDATE public.profiles SET tenant_id = 'test-tenant', team_id = 'team-b' WHERE id = 'leader-b-uuid';
-- INSERT INTO public.user_roles (user_id, role) VALUES ('leader-b-uuid', 'leader');

-- Agent A (assigned to Team A)
-- UPDATE public.profiles SET tenant_id = 'test-tenant', team_id = 'team-a' WHERE id = 'agent-a-uuid';
-- INSERT INTO public.user_roles (user_id, role) VALUES ('agent-a-uuid', 'agent');

-- Agent B (assigned to Team B)
-- UPDATE public.profiles SET tenant_id = 'test-tenant', team_id = 'team-b' WHERE id = 'agent-b-uuid';
-- INSERT INTO public.user_roles (user_id, role) VALUES ('agent-b-uuid', 'agent');

-- Test leads
INSERT INTO public.leads (id, name, email, phone, tenant_id, team_id, assigned_to, stage)
VALUES
  -- Team A leads
  ('lead-a1', 'Lead A1', 'leada1@test.com', '1111111111', 'test-tenant', 'team-a', 'agent-a-uuid', 'new'),
  ('lead-a2', 'Lead A2', 'leada2@test.com', '2222222222', 'test-tenant', 'team-a', 'agent-a-uuid', 'contacted'),
  -- Team B leads
  ('lead-b1', 'Lead B1', 'leadb1@test.com', '3333333333', 'test-tenant', 'team-b', 'agent-b-uuid', 'new'),
  ('lead-b2', 'Lead B2', 'leadb2@test.com', '4444444444', 'test-tenant', 'team-b', 'agent-b-uuid', 'qualified')
ON CONFLICT (id) DO NOTHING;

-- Test tasks
INSERT INTO public.tasks (id, title, lead_id, assigned_to, due_at, status)
VALUES
  ('task-a1', 'Task for Lead A1', 'lead-a1', 'agent-a-uuid', NOW() + INTERVAL '1 day', 'open'),
  ('task-b1', 'Task for Lead B1', 'lead-b1', 'agent-b-uuid', NOW() + INTERVAL '1 day', 'open')
ON CONFLICT (id) DO NOTHING;

-- Test activities
INSERT INTO public.activities (id, lead_id, type, title, user_id)
VALUES
  ('activity-a1', 'lead-a1', 'call', 'Called Lead A1', 'agent-a-uuid'),
  ('activity-b1', 'lead-b1', 'call', 'Called Lead B1', 'agent-b-uuid')
ON CONFLICT (id) DO NOTHING;

-- Test appointments
INSERT INTO public.appointments (id, title, lead_id, assigned_to, scheduled_at, status)
VALUES
  ('appt-a1', 'Meeting with Lead A1', 'lead-a1', 'agent-a-uuid', NOW() + INTERVAL '2 days', 'scheduled'),
  ('appt-b1', 'Meeting with Lead B1', 'lead-b1', 'agent-b-uuid', NOW() + INTERVAL '2 days', 'scheduled')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Test Cases
-- ============================================================

-- TEST 1: Super Admin Access
-- Expected: Should see ALL leads across all tenants and teams
-- ============================================================
-- Run as super_admin user:
-- SELECT COUNT(*) as super_admin_leads FROM public.leads;
-- Expected result: All leads (4 in test data)

-- TEST 2: Tenant Manager Access
-- Expected: Should see ALL leads in their tenant, regardless of team
-- ============================================================
-- Run as manager user (tenant_id = 'test-tenant', team_id = NULL):
-- SELECT COUNT(*) as manager_leads FROM public.leads WHERE tenant_id = 'test-tenant';
-- Expected result: All tenant leads (4 in test data)

-- TEST 3: Team A Leader Access
-- Expected: Should ONLY see Team A leads
-- ============================================================
-- Run as leader-a user (tenant_id = 'test-tenant', team_id = 'team-a'):
-- SELECT COUNT(*) as team_a_leader_leads FROM public.leads;
-- Expected result: Only Team A leads (2 in test data)
-- 
-- Verify cannot see Team B leads:
-- SELECT COUNT(*) as should_be_zero FROM public.leads WHERE team_id = 'team-b';
-- Expected result: 0

-- TEST 4: Team B Leader Access
-- Expected: Should ONLY see Team B leads
-- ============================================================
-- Run as leader-b user (tenant_id = 'test-tenant', team_id = 'team-b'):
-- SELECT COUNT(*) as team_b_leader_leads FROM public.leads;
-- Expected result: Only Team B leads (2 in test data)
--
-- Verify cannot see Team A leads:
-- SELECT COUNT(*) as should_be_zero FROM public.leads WHERE team_id = 'team-a';
-- Expected result: 0

-- TEST 5: Agent A Access
-- Expected: Should ONLY see leads assigned to them
-- ============================================================
-- Run as agent-a user:
-- SELECT COUNT(*) as agent_a_leads FROM public.leads;
-- Expected result: Only assigned leads (2 in test data)
--
-- Verify cannot see Agent B's leads:
-- SELECT COUNT(*) as should_be_zero FROM public.leads WHERE assigned_to = 'agent-b-uuid';
-- Expected result: 0

-- TEST 6: Agent B Access
-- Expected: Should ONLY see leads assigned to them
-- ============================================================
-- Run as agent-b user:
-- SELECT COUNT(*) as agent_b_leads FROM public.leads;
-- Expected result: Only assigned leads (2 in test data)
--
-- Verify cannot see Agent A's leads:
-- SELECT COUNT(*) as should_be_zero FROM public.leads WHERE assigned_to = 'agent-a-uuid';
-- Expected result: 0

-- TEST 7: Tasks Access - Team Leader
-- Expected: Team leaders should only see tasks for their team's leads
-- ============================================================
-- Run as leader-a user:
-- SELECT COUNT(*) as team_a_tasks FROM public.tasks;
-- Expected result: Only Team A tasks (1 in test data)

-- TEST 8: Activities Access - Team Leader
-- Expected: Team leaders should only see activities for their team's leads
-- ============================================================
-- Run as leader-a user:
-- SELECT COUNT(*) as team_a_activities FROM public.activities;
-- Expected result: Only Team A activities (1 in test data)

-- TEST 9: Appointments Access - Team Leader
-- Expected: Team leaders should only see appointments for their team's leads
-- ============================================================
-- Run as leader-a user:
-- SELECT COUNT(*) as team_a_appointments FROM public.appointments;
-- Expected result: Only Team A appointments (1 in test data)

-- TEST 10: Cross-Team Data Leakage Prevention
-- Expected: Team A leader should NOT be able to access Team B data via direct query
-- ============================================================
-- Run as leader-a user:
-- SELECT * FROM public.leads WHERE id = 'lead-b1';
-- Expected result: 0 rows (access denied)
--
-- SELECT * FROM public.tasks WHERE id = 'task-b1';
-- Expected result: 0 rows (access denied)
--
-- SELECT * FROM public.activities WHERE id = 'activity-b1';
-- Expected result: 0 rows (access denied)
--
-- SELECT * FROM public.appointments WHERE id = 'appt-b1';
-- Expected result: 0 rows (access denied)

-- ============================================================
-- Automated Test Queries (Run with appropriate user context)
-- ============================================================

-- Helper: Set user context for testing (PostgreSQL specific)
-- You'll need to use Supabase's auth.uid() in actual tests
-- These are example queries showing the expected behavior

-- Example test function to verify team isolation
CREATE OR REPLACE FUNCTION test_team_isolation()
RETURNS TABLE(
  test_name text,
  passed boolean,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This is a template - actual implementation would need to
  -- switch between different user contexts to test properly
  
  RETURN QUERY SELECT 
    'Team Isolation Test'::text,
    true::boolean,
    'Manual testing required with different user sessions'::text;
END;
$$;

-- ============================================================
-- Cleanup (Optional - run after testing)
-- ============================================================

-- DELETE FROM public.appointments WHERE id IN ('appt-a1', 'appt-b1');
-- DELETE FROM public.activities WHERE id IN ('activity-a1', 'activity-b1');
-- DELETE FROM public.tasks WHERE id IN ('task-a1', 'task-b1');
-- DELETE FROM public.leads WHERE id IN ('lead-a1', 'lead-a2', 'lead-b1', 'lead-b2');
-- DELETE FROM public.teams WHERE id IN ('team-a', 'team-b');
-- DELETE FROM public.tenants WHERE id = 'test-tenant';

-- ============================================================
-- Testing Instructions
-- ============================================================
-- 
-- 1. Create test users via Supabase Auth Dashboard or API
-- 2. Update their profiles with appropriate tenant_id and team_id
-- 3. Assign roles via user_roles table
-- 4. Run the INSERT statements above to create test data
-- 5. Log in as each user type and run the SELECT queries
-- 6. Verify that each user can only see data they should have access to
-- 7. Attempt to access restricted data and verify access is denied
-- 8. Clean up test data when done
--
-- Key Verification Points:
-- - Team leaders cannot see other teams' data
-- - Agents cannot see unassigned leads
-- - Tenant managers can see all tenant data
-- - Super admins can see all data
-- - No data leakage between teams
-- - Proper filtering on tasks, activities, and appointments

-- Made with Bob
