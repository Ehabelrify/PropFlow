-- Remove default team creation from complete_manager_signup
-- Managers will now create teams manually

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
  _initials TEXT;
  _result JSONB;
BEGIN
  -- Generate tenant ID
  _tenant_id := 't_' || replace(gen_random_uuid()::text, '-', '');

  -- Derive initials from tenant name
  _initials := upper(substring(_tenant_name from '(\S)\S*\s*(\S)?'));
  IF _initials IS NULL OR length(_initials) = 0 THEN
    _initials := upper(substring(_tenant_name, 1, 2));
  END IF;

  -- Create tenant with pending_approval status
  INSERT INTO tenants (id, name, slug, plan, status, seats)
  VALUES (_tenant_id, _tenant_name, _tenant_slug, _plan, 'pending_approval', _seats);

  -- Update the manager's profile with tenant info
  UPDATE profiles
  SET tenant_id = _tenant_id,
      name = COALESCE(name, split_part((SELECT email FROM auth.users WHERE id = _user_id), '@', 1))
  WHERE id = _user_id;

  -- Assign manager role (remove default agent role)
  DELETE FROM user_roles WHERE user_id = _user_id AND role = 'agent';
  INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'manager');

  -- Return tenant info (no default team created)
  _result := jsonb_build_object(
    'tenant_id', _tenant_id,
    'tenant_name', _tenant_name,
    'status', 'pending_approval'
  );

  RETURN _result;
END;
$$;

-- Revoke/grant permissions
REVOKE EXECUTE ON FUNCTION public.complete_manager_signup(UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_manager_signup(UUID, TEXT, TEXT, TEXT, INT) TO authenticated;
