-- Task Due Date Validation and Orphaned Records Handling
-- Prevents tasks with past due dates and handles orphaned records when teams are deleted

-- 1. TASK DUE DATE VALIDATION

-- Function to validate task due date
CREATE OR REPLACE FUNCTION validate_task_due_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate on INSERT or when due_at is being updated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.due_at IS DISTINCT FROM OLD.due_at) THEN
    -- Allow NULL due dates (tasks without deadlines)
    IF NEW.due_at IS NULL THEN
      RETURN NEW;
    END IF;

    -- Check if due date is in the past (more than 1 hour ago to account for timezone issues)
    IF NEW.due_at < (NOW() - INTERVAL '1 hour') THEN
      RAISE EXCEPTION 'Task due date cannot be in the past. Please select a future date.'
        USING HINT = 'Due date must be at least 1 hour from now',
              ERRCODE = '23514'; -- check_violation
    END IF;

    -- Check if due date is too far in the future (more than 5 years)
    IF NEW.due_at > (NOW() + INTERVAL '5 years') THEN
      RAISE EXCEPTION 'Task due date is too far in the future (maximum 5 years)'
        USING HINT = 'Please select a more reasonable due date',
              ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task due date validation
DROP TRIGGER IF EXISTS validate_task_due_date_trigger ON tasks;

CREATE TRIGGER validate_task_due_date_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_due_date();

-- Add check constraint as additional safety (database level)
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_due_at_not_past;

ALTER TABLE tasks
ADD CONSTRAINT tasks_due_at_not_past
CHECK (due_at IS NULL OR due_at >= (NOW() - INTERVAL '1 hour'));

-- 2. ORPHANED RECORDS HANDLING

-- Function to handle orphaned records when a team is deleted
CREATE OR REPLACE FUNCTION handle_team_deletion()
RETURNS TRIGGER AS $$
DECLARE
  tenant_default_team_id UUID;
  affected_leads_count INTEGER;
  affected_users_count INTEGER;
BEGIN
  -- Get or create a default "Unassigned" team for this tenant
  SELECT id INTO tenant_default_team_id
  FROM teams
  WHERE tenant_id = OLD.tenant_id
    AND name = 'Unassigned'
  LIMIT 1;

  -- If no default team exists, create one
  IF tenant_default_team_id IS NULL THEN
    INSERT INTO teams (tenant_id, name, leader_id)
    VALUES (
      OLD.tenant_id,
      'Unassigned',
      (SELECT p.id FROM profiles p
       JOIN user_roles ur ON p.id = ur.user_id
       WHERE p.tenant_id = OLD.tenant_id AND ur.role = 'manager' LIMIT 1)
    )
    RETURNING id INTO tenant_default_team_id;
  END IF;

  -- Reassign leads from deleted team to default team
  UPDATE leads
  SET 
    team_id = tenant_default_team_id,
    updated_at = NOW()
  WHERE team_id = OLD.id;

  GET DIAGNOSTICS affected_leads_count = ROW_COUNT;

  -- Reassign users from deleted team to default team
  UPDATE profiles
  SET
    team_id = tenant_default_team_id,
    updated_at = NOW()
  WHERE team_id = OLD.id;

  GET DIAGNOSTICS affected_users_count = ROW_COUNT;

  -- Log the reassignment
  RAISE NOTICE 'Team % deleted. Reassigned % leads and % users to default team %',
    OLD.name, affected_leads_count, affected_users_count, tenant_default_team_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for team deletion
DROP TRIGGER IF EXISTS handle_team_deletion_trigger ON teams;

CREATE TRIGGER handle_team_deletion_trigger
  BEFORE DELETE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION handle_team_deletion();

-- Function to handle orphaned records when a user is deleted
CREATE OR REPLACE FUNCTION handle_user_deletion()
RETURNS TRIGGER AS $$
DECLARE
  tenant_manager_id UUID;
  affected_leads_count INTEGER;
  affected_tasks_count INTEGER;
  affected_appointments_count INTEGER;
BEGIN
  -- Find a manager in the same tenant to reassign to
  SELECT p.id INTO tenant_manager_id
  FROM profiles p
  JOIN user_roles ur ON p.id = ur.user_id
  WHERE p.tenant_id = OLD.tenant_id
    AND ur.role IN ('manager', 'super_admin')
    AND p.id != OLD.id
  LIMIT 1;

  -- If no manager found, find any user in the tenant
  IF tenant_manager_id IS NULL THEN
    SELECT id INTO tenant_manager_id
    FROM profiles
    WHERE tenant_id = OLD.tenant_id
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
    -- No other users in tenant - this shouldn't happen in production
    -- Activities will be kept for audit trail (they reference user_id but don't need reassignment)
    RAISE NOTICE 'User % deleted. No other users in tenant to reassign to.', OLD.email;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user deletion (on auth.users, not profiles)
-- Note: When auth.users is deleted, profiles cascade deletes automatically
DROP TRIGGER IF EXISTS handle_user_deletion_trigger ON auth.users;

CREATE TRIGGER handle_user_deletion_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_deletion();

-- 3. APPOINTMENT DATE VALIDATION (similar to tasks)

-- Function to validate appointment date
CREATE OR REPLACE FUNCTION validate_appointment_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate on INSERT or when scheduled_at is being updated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN
    -- Check if appointment is in the past (more than 1 hour ago)
    IF NEW.scheduled_at < (NOW() - INTERVAL '1 hour') THEN
      RAISE EXCEPTION 'Appointment date cannot be in the past. Please select a future date.'
        USING HINT = 'Scheduled time must be at least 1 hour from now',
              ERRCODE = '23514'; -- check_violation
    END IF;

    -- Check if appointment is too far in the future (more than 2 years)
    IF NEW.scheduled_at > (NOW() + INTERVAL '2 years') THEN
      RAISE EXCEPTION 'Appointment date is too far in the future (maximum 2 years)'
        USING HINT = 'Please select a more reasonable date',
              ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for appointment date validation
DROP TRIGGER IF EXISTS validate_appointment_date_trigger ON appointments;

CREATE TRIGGER validate_appointment_date_trigger
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION validate_appointment_date();

-- Add check constraint for appointments
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_scheduled_at_not_past;

ALTER TABLE appointments
ADD CONSTRAINT appointments_scheduled_at_not_past
CHECK (scheduled_at >= (NOW() - INTERVAL '1 hour'));

-- Add comments
COMMENT ON FUNCTION validate_task_due_date IS 'Prevents tasks from being created with past due dates';
COMMENT ON FUNCTION handle_team_deletion IS 'Reassigns leads and users to default team when a team is deleted';
COMMENT ON FUNCTION handle_user_deletion IS 'Reassigns leads, tasks, and appointments when a user is deleted';
COMMENT ON FUNCTION validate_appointment_date IS 'Prevents appointments from being scheduled in the past';

-- Create indexes for better performance on reassignment queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_leads_team_id ON leads(team_id);

-- Made with Bob
