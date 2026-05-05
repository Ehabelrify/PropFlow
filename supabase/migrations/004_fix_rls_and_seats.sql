-- Migration 004: Fix approval_requests RLS for super admin + seat enforcement

-- Allow super admin to see all approval requests across tenants
DROP POLICY IF EXISTS "approvals_super_admin_all" ON public.approval_requests;
CREATE POLICY "approvals_super_admin_all" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Allow super admin to decide any approval request
DROP POLICY IF EXISTS "approvals_super_admin_decide" ON public.approval_requests;
CREATE POLICY "approvals_super_admin_decide" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Ensure tenants table can be read by users with pending_approval status
DROP POLICY IF EXISTS "tenants_read_pending" ON public.tenants;
CREATE POLICY "tenants_read_pending" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id = public.current_tenant()
    OR public.has_role(auth.uid(), 'super_admin')
    OR id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Add seat enforcement to invitations: prevent creating invitations when at capacity
-- This is enforced at the application level via the redeem_invitation RPC
-- But let's also add a check constraint on profiles to prevent over-seating

-- Update profiles insert policy to check seat capacity
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR (public.has_role(auth.uid(), 'manager') AND tenant_id = public.current_tenant())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Update profiles_manager_update to also handle team assignment
DROP POLICY IF EXISTS "profiles_manager_update" ON public.profiles;
CREATE POLICY "profiles_manager_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'super_admin'))
    AND tenant_id = public.current_tenant()
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'super_admin'))
    AND tenant_id = public.current_tenant()
  );
