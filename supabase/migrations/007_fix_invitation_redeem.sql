-- Migration 007: Fix invitation redeem to assign team_id and ensure tenant assignment

-- 1. Add team_id column to invitations table if not exists
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL;

-- 2. Update redeem_invitation function to also assign team_id
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
  
  -- Update profile with tenant_id AND team_id
  UPDATE profiles 
  SET 
    tenant_id = _invitation.tenant_id,
    team_id = _invitation.team_id
  WHERE id = _user_id;
  
  -- Assign agent role (if not already assigned)
  INSERT INTO user_roles (user_id, role) 
  VALUES (_user_id, 'agent') 
  ON CONFLICT DO NOTHING;
  
  _result := jsonb_build_object(
    'tenant_id', _invitation.tenant_id,
    'team_id', _invitation.team_id,
    'tenant_name', (SELECT name FROM tenants WHERE id = _invitation.tenant_id)
  );
  
  -- Deactivate the invitation after use (optional, comment out if you want to allow reuse)
  UPDATE invitations SET is_active = false WHERE id = _invitation.id;
  
  RETURN _result;
END;
$$;

-- Grant execute permission
REVOKE EXECUTE ON FUNCTION public.redeem_invitation(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT, UUID) TO authenticated;
