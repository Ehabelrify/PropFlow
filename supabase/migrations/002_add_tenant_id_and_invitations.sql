-- Migration 002: Add tenant_id to activities, appointments, tasks for proper audit logging

-- Add tenant_id columns
ALTER TABLE activities ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Backfill from related leads table
UPDATE activities SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = activities.lead_id) WHERE tenant_id IS NULL;
UPDATE appointments SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = appointments.lead_id) WHERE tenant_id IS NULL;
UPDATE tasks SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = tasks.lead_id) WHERE tenant_id IS NULL;

-- Add RLS policies for activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Activities can be updated by tenant members" ON activities;
CREATE POLICY "Activities can be updated by tenant members" ON activities
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Activities can be deleted by tenant members" ON activities;
CREATE POLICY "Activities can be deleted by tenant members" ON activities
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Add RLS policies for appointments
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

DROP POLICY IF EXISTS "Appointments can be updated by tenant members" ON appointments;
CREATE POLICY "Appointments can be updated by tenant members" ON appointments
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Appointments can be deleted by tenant members" ON appointments;
CREATE POLICY "Appointments can be deleted by tenant members" ON appointments
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Add RLS policies for tasks
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

DROP POLICY IF EXISTS "Tasks can be updated by tenant members" ON tasks;
CREATE POLICY "Tasks can be updated by tenant members" ON tasks
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tasks can be deleted by tenant members" ON tasks;
CREATE POLICY "Tasks can be deleted by tenant members" ON tasks
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Update tenant status check constraint to allow pending_approval
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'trial', 'pending_approval', 'rejected'));

-- Create invitations table
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
