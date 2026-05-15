-- ============================================================
-- Migration 012: Enhanced Invitation Validation
-- Adds database-level validation and security for invitations
-- ============================================================

-- Add validation constraints to invitations table
ALTER TABLE public.invitations
  ADD CONSTRAINT invitation_code_format CHECK (code ~ '^[A-Z0-9]{6}$'),
  ADD CONSTRAINT invitation_expires_future CHECK (expires_at > created_at);

-- Create index for faster code lookups
CREATE INDEX IF NOT EXISTS idx_invitations_code_active 
  ON public.invitations(code) 
  WHERE is_active = true;

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at 
  ON public.invitations(expires_at) 
  WHERE is_active = true;

-- Enhanced redeem_invitation function with better validation
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
    -- Log the error
    RAISE NOTICE 'Error redeeming invitation: %', SQLERRM;
    RAISE;
END;
$$;

-- Function to cleanup expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Deactivate expired invitations
  UPDATE public.invitations
  SET is_active = false
  WHERE is_active = true
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- Function to validate invitation before display
CREATE OR REPLACE FUNCTION public.validate_invitation_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_tenant record;
  v_result jsonb;
BEGIN
  -- Validate format
  IF _code IS NULL OR _code = '' OR _code !~ '^[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid code format'
    );
  END IF;

  -- Find invitation
  SELECT i.*, t.name as tenant_name, t.status as tenant_status
  INTO v_invitation
  FROM public.invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.code = _code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invitation not found'
    );
  END IF;

  -- Check if active
  IF NOT v_invitation.is_active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invitation has been used or revoked'
    );
  END IF;

  -- Check if expired
  IF v_invitation.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invitation has expired'
    );
  END IF;

  -- Check tenant status
  IF v_invitation.tenant_status != 'active' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Workspace is not active'
    );
  END IF;

  -- Return valid invitation info
  RETURN jsonb_build_object(
    'valid', true,
    'tenant_name', v_invitation.tenant_name,
    'expires_at', v_invitation.expires_at,
    'has_team', v_invitation.team_id IS NOT NULL
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.redeem_invitation(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invitation_code(text) TO authenticated;

-- Create a scheduled job to cleanup expired invitations (if pg_cron is available)
-- This is optional and depends on your Supabase plan
-- SELECT cron.schedule(
--   'cleanup-expired-invitations',
--   '0 0 * * *', -- Run daily at midnight
--   $$SELECT public.cleanup_expired_invitations()$$
-- );

-- Add comment for documentation
COMMENT ON FUNCTION public.redeem_invitation IS 
'Redeems an invitation code with enhanced validation and security checks';

COMMENT ON FUNCTION public.cleanup_expired_invitations IS 
'Deactivates expired invitations - should be run periodically';

COMMENT ON FUNCTION public.validate_invitation_code IS 
'Validates an invitation code without redeeming it - useful for preview';

-- ============================================================
-- Migration Complete
-- ============================================================
-- This migration adds:
-- 1. Database-level validation constraints for invitation codes
-- 2. Enhanced redeem_invitation function with better error handling
-- 3. Invitation validation function for preview
-- 4. Cleanup function for expired invitations
-- 5. Proper indexes for performance
-- 6. Activity logging for invitation redemptions
-- 7. Race condition prevention with row locking

-- Made with Bob
