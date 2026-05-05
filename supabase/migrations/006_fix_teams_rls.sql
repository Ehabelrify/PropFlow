-- Drop existing teams policies
DROP POLICY IF EXISTS "teams_read_tenant" ON public.teams;
DROP POLICY IF EXISTS "teams_manager_write" ON public.teams;
DROP POLICY IF EXISTS "teams_read_access" ON public.teams;
DROP POLICY IF EXISTS "teams_write_access" ON public.teams;

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- SELECT policy: 
-- 1. Allow users to see teams in their tenant (via current_tenant())
-- 2. Allow super_admin to see all teams
CREATE POLICY "teams_select_policy" ON public.teams
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant()
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ALL policy: managers and super_admins can modify teams
CREATE POLICY "teams_all_policy" ON public.teams
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Grant permissions
GRANT SELECT ON public.teams TO authenticated;
GRANT INSERT ON public.teams TO authenticated;
GRANT UPDATE ON public.teams TO authenticated;
GRANT DELETE ON public.teams TO authenticated;
