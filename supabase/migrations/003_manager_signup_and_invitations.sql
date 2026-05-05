-- Migration 003: Manager signup RPC + invitations table + pending_approval tenant flow

-- 1. Create invitations table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitations are viewable by tenant members" ON invitations;
CREATE POLICY "Invitations are viewable by tenant members" ON invitations
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Invitations can be managed by managers" ON invitations;
CREATE POLICY "Invitations can be managed by managers" ON invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid() AND ur.role IN ('manager', 'super_admin')
      AND p.tenant_id = invitations.tenant_id
    )
  );

-- 2. Update tenant status check constraint
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'trial', 'pending_approval', 'rejected'));

-- 3. Add tenant_id to audit tables (idempotent)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Backfill tenant_id from leads
UPDATE activities SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = activities.lead_id) WHERE tenant_id IS NULL;
UPDATE appointments SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = appointments.lead_id) WHERE tenant_id IS NULL;
UPDATE tasks SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = tasks.lead_id) WHERE tenant_id IS NULL;

-- Add RLS for activities
DROP POLICY IF EXISTS "Activities are viewable by tenant members" ON activities;
CREATE POLICY "Activities are viewable by tenant members" ON activities
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
DROP POLICY IF EXISTS "Activities can be inserted by tenant members" ON activities;
CREATE POLICY "Activities can be inserted by tenant members" ON activities
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Add RLS for appointments
DROP POLICY IF EXISTS "Appointments are viewable by tenant members" ON appointments;
CREATE POLICY "Appointments are viewable by tenant members" ON appointments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
DROP POLICY IF EXISTS "Appointments can be inserted by tenant members" ON appointments;
CREATE POLICY "Appointments can be inserted by tenant members" ON appointments
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Add RLS for tasks
DROP POLICY IF EXISTS "Tasks are viewable by tenant members" ON tasks;
CREATE POLICY "Tasks are viewable by tenant members" ON tasks
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
DROP POLICY IF EXISTS "Tasks can be inserted by tenant members" ON tasks;
CREATE POLICY "Tasks can be inserted by tenant members" ON tasks
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- 4. Manager signup RPC function
-- This function is called AFTER supabase.auth.signUp() on the client.
-- It creates the tenant, updates the profile, assigns manager role, and creates a default team.
CREATE OR REPLACE FUNCTION public.complete_manager_signup(
  _user_id UUID,
  _tenant_name TEXT,
  _tenant_slug TEXT,
  _plan TEXT DEFAULT 'starter',
  _seats INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id TEXT;
  _team_id TEXT;
  _initials TEXT;
  _result JSONB;
BEGIN
  -- Generate IDs
  _tenant_id := 't_' || replace(gen_random_uuid()::text, '-', '');
  _team_id := 'tm_' || replace(gen_random_uuid()::text, '-', '');

  -- Derive initials
  _initials := upper(substring(_tenant_name from '(\S)\S*\s*(\S)?'));
  IF _initials IS NULL OR length(_initials) = 0 THEN
    _initials := upper(substring(_tenant_name, 1, 2));
  END IF;

  -- Create tenant with pending_approval status
  INSERT INTO tenants (id, name, slug, plan, status, seats)
  VALUES (_tenant_id, _tenant_name, _tenant_slug, _plan, 'pending_approval', _seats);

  -- Update the profile (created by handle_new_user trigger) with tenant info
  UPDATE profiles
  SET tenant_id = _tenant_id,
      name = COALESCE(name, split_part((SELECT email FROM auth.users WHERE id = _user_id), '@', 1))
  WHERE id = _user_id;

  -- Assign manager role (remove the default agent role)
  DELETE FROM user_roles WHERE user_id = _user_id AND role = 'agent';
  INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'manager');

  -- Create default team
  INSERT INTO teams (id, tenant_id, name, leader_id)
  VALUES (_team_id, _tenant_id, _tenant_name || ' — Default Team', _user_id);

  -- Return tenant info for the client
  _result := jsonb_build_object(
    'tenant_id', _tenant_id,
    'tenant_name', _tenant_name,
    'status', 'pending_approval',
    'team_id', _team_id
  );

  RETURN _result;
END;
$$;

-- Grant execute to authenticated users
REVOKE EXECUTE ON FUNCTION public.complete_manager_signup(UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_manager_signup(UUID, TEXT, TEXT, TEXT, INT) TO authenticated;

-- 5. Update handle_new_user to support tenant_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name TEXT := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  _initials TEXT := upper(substring(regexp_replace(_name, '[^a-zA-Z ]', '', 'g'), 1, 2));
  _tenant_id TEXT := NEW.raw_user_meta_data->>'tenant_id';
BEGIN
  INSERT INTO public.profiles (id, name, email, initials, tenant_id)
    VALUES (NEW.id, _name, NEW.email, _initials, _tenant_id);

  -- Only assign agent role if no tenant_id (existing user flow)
  -- If tenant_id is provided, the complete_manager_signup RPC will handle roles
  IF _tenant_id IS NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Invitation redeem function
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  _code TEXT,
  _user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _result JSONB;
BEGIN
  -- Find the invitation
  SELECT * INTO _invitation FROM invitations WHERE code = _code AND is_active = true AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  -- Check tenant is active
  IF (SELECT status FROM tenants WHERE id = _invitation.tenant_id) != 'active' THEN
    RAISE EXCEPTION 'This organization is not active';
  END IF;

  -- Check seat capacity
  IF (SELECT COUNT(*) FROM profiles WHERE tenant_id = _invitation.tenant_id) >= (SELECT seats FROM tenants WHERE id = _invitation.tenant_id) THEN
    RAISE EXCEPTION 'Organization has reached its seat limit';
  END IF;

  -- Update profile with tenant info
  UPDATE profiles SET tenant_id = _invitation.tenant_id WHERE id = _user_id;

  -- Assign agent role
  INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'agent') ON CONFLICT DO NOTHING;

  _result := jsonb_build_object(
    'tenant_id', _invitation.tenant_id,
    'tenant_name', (SELECT name FROM tenants WHERE id = _invitation.tenant_id)
  );

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invitation(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT, UUID) TO authenticated;

-- 7. Super admin approve tenant function
CREATE OR REPLACE FUNCTION public.approve_tenant_signup(
  _tenant_id TEXT,
  _approver_id UUID,
  _approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_status TEXT;
  _result JSONB;
BEGIN
  -- Verify approver is super admin
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _approver_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can approve tenants';
  END IF;

  _new_status := CASE WHEN _approve THEN 'active' ELSE 'rejected' END;

  UPDATE tenants SET status = _new_status, updated_at = now() WHERE id = _tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  _result := jsonb_build_object(
    'tenant_id', _tenant_id,
    'status', _new_status
  );

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_tenant_signup(TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_tenant_signup(TEXT, UUID, BOOLEAN) TO authenticated;
