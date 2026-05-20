-- ============================================================
-- Migration 017: High Priority Fixes
-- Addresses: Issues #11, #12, #13, #34, #49
-- ============================================================

-- ISSUE #12: Restore seat capacity check in redeem_invitation
-- Migration 012 dropped the seat check that existed in 007
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  _code text,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_tenant_id uuid;
  v_team_id uuid;
  v_result jsonb;
BEGIN
  -- Validate input format
  IF _code IS NULL OR _code = '' THEN
    RAISE EXCEPTION 'Invitation code is required';
  END IF;

  IF _code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid invitation code format';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Find and validate invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE code = _code
    AND is_active = true
    AND expires_at > NOW()
  FOR UPDATE; -- Lock the row to prevent race conditions

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  -- Check if user already belongs to a tenant
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = _user_id;

  IF v_tenant_id IS NOT NULL AND v_tenant_id != v_invitation.tenant_id THEN
    RAISE EXCEPTION 'User already belongs to another workspace';
  END IF;

  -- Check tenant status
  DECLARE
    v_tenant_status text;
  BEGIN
    SELECT status INTO v_tenant_status
    FROM public.tenants
    WHERE id = v_invitation.tenant_id;

    IF v_tenant_status != 'active' THEN
      RAISE EXCEPTION 'Workspace is not active';
    END IF;
  END;

  -- ISSUE #12: Check seat capacity (restored from migration 007)
  IF (SELECT COUNT(*) FROM public.profiles WHERE tenant_id = v_invitation.tenant_id) >=
     (SELECT seats FROM public.tenants WHERE id = v_invitation.tenant_id) THEN
    RAISE EXCEPTION 'Organization has reached its seat limit';
  END IF;

  -- Update user profile
  UPDATE public.profiles
  SET
    tenant_id = v_invitation.tenant_id,
    team_id = v_invitation.team_id,
    updated_at = NOW()
  WHERE id = _user_id;

  -- Assign default agent role if user has no roles
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'agent');
  END IF;

  -- Mark invitation as used (deactivate it)
  UPDATE public.invitations
  SET
    is_active = false,
    used_by = _user_id,
    used_at = NOW()
  WHERE id = v_invitation.id;

  -- Log the redemption
  INSERT INTO public.activities (
    type,
    description,
    user_id,
    tenant_id,
    metadata
  ) VALUES (
    'invitation_redeemed',
    'User joined workspace via invitation',
    _user_id,
    v_invitation.tenant_id,
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'invitation_code', v_invitation.code,
      'team_id', v_invitation.team_id
    )
  );

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'tenant_id', v_invitation.tenant_id,
    'team_id', v_invitation.team_id,
    'message', 'Successfully joined workspace'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error redeeming invitation: %', SQLERRM;
    RAISE;
END;
$$;

-- ISSUE #11 & #34: Fix bulk_assign_leads to trigger lead score recalculation
-- Add assigned_to to the trigger columns for lead score recalculation
DROP TRIGGER IF EXISTS recalculate_lead_score_on_update ON leads;

CREATE TRIGGER recalculate_lead_score_on_update
  AFTER UPDATE OF stage, budget, requirements, notes, property_interest, last_activity_at, assigned_to
  ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- ISSUE #13: Fix find_duplicate_leads parameter type mismatch
-- p_tenant_id should be TEXT not UUID since leads.tenant_id is text
CREATE OR REPLACE FUNCTION public.find_duplicate_leads(
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_tenant_id TEXT DEFAULT NULL,  -- Changed from UUID to TEXT
  p_exclude_lead_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  stage TEXT,
  created_at TIMESTAMPTZ,
  match_type TEXT,
  confidence INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.email,
    l.phone,
    l.stage::TEXT,
    l.created_at,
    CASE
      WHEN LOWER(l.email) = LOWER(p_email) THEN 'email_exact'
      WHEN l.phone = p_phone AND p_phone IS NOT NULL AND p_phone != '' THEN 'phone_exact'
      WHEN LOWER(l.email) LIKE '%' || LOWER(SPLIT_PART(p_email, '@', 1)) || '%' THEN 'email_similar'
      ELSE 'unknown'
    END AS match_type,
    CASE
      WHEN LOWER(l.email) = LOWER(p_email) THEN 100
      WHEN l.phone = p_phone AND p_phone IS NOT NULL AND p_phone != '' THEN 95
      WHEN LOWER(l.email) LIKE '%' || LOWER(SPLIT_PART(p_email, '@', 1)) || '%' THEN 70
      ELSE 50
    END AS confidence
  FROM leads l
  WHERE
    l.tenant_id = COALESCE(p_tenant_id, l.tenant_id)
    AND (p_exclude_lead_id IS NULL OR l.id != p_exclude_lead_id)
    AND (
      LOWER(l.email) = LOWER(p_email)
      OR (p_phone IS NOT NULL AND p_phone != '' AND l.phone = p_phone)
      OR LOWER(l.email) LIKE '%' || LOWER(SPLIT_PART(p_email, '@', 1)) || '%'
    )
  ORDER BY confidence DESC, l.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ISSUE #49: Fix password_reset_attempts RLS to allow SECURITY DEFINER functions
-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "System only access" ON public.password_reset_attempts;

-- Create policy that allows SECURITY DEFINER functions to work
-- The functions check_password_reset_rate_limit and log_password_reset_attempt
-- are SECURITY DEFINER, so they bypass RLS. But we need a policy for direct access too.
CREATE POLICY "password_reset_attempts_system_access"
  ON public.password_reset_attempts
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Grant function permissions to allow usage
GRANT EXECUTE ON FUNCTION public.check_password_reset_rate_limit(text, inet) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_password_reset_attempt(text, inet, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_password_reset_attempts() TO authenticated;

-- Made with Bob
