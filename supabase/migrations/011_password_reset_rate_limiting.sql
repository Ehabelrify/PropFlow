-- Password Reset Rate Limiting
-- Migration: 011_password_reset_rate_limiting.sql

-- Create table to track password reset attempts
CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address inet,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_email
  ON public.password_reset_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_ip
  ON public.password_reset_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_created
  ON public.password_reset_attempts(created_at);

-- Enable RLS
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

-- Only system can write to this table (no user access)
DROP POLICY IF EXISTS "System only access" ON public.password_reset_attempts;
CREATE POLICY "System only access"
  ON public.password_reset_attempts
  FOR ALL
  TO authenticated
  USING (false);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_password_reset_rate_limit(
  p_email text,
  p_ip_address inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hourly_email_attempts integer;
  v_daily_email_attempts integer;
  v_ip_attempts integer;
  v_last_attempt timestamptz;
  v_cooldown_minutes integer := 15;
  v_max_attempts_per_hour integer := 3;
  v_max_attempts_per_day integer := 10;
BEGIN
  -- Count attempts by email in last hour
  SELECT COUNT(*), MAX(attempted_at)
  INTO v_hourly_email_attempts, v_last_attempt
  FROM public.password_reset_attempts
  WHERE email = lower(trim(p_email))
    AND attempted_at > now() - interval '1 hour';

  -- Check if in cooldown period (15 minutes after 3 attempts)
  IF v_hourly_email_attempts >= v_max_attempts_per_hour THEN
    IF v_last_attempt > now() - make_interval(mins => v_cooldown_minutes) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'rate_limit_exceeded',
        'retry_after', GREATEST(
          EXTRACT(EPOCH FROM (v_last_attempt + make_interval(mins => v_cooldown_minutes) - now()))::integer,
          0
        ),
        'message', 'Too many password reset attempts. Please try again in ' ||
          CEIL(
            GREATEST(
              EXTRACT(EPOCH FROM (v_last_attempt + make_interval(mins => v_cooldown_minutes) - now())),
              0
            ) / 60
          )::text || ' minutes.'
      );
    END IF;
  END IF;

  -- Count attempts by email in last 24 hours
  SELECT COUNT(*)
  INTO v_daily_email_attempts
  FROM public.password_reset_attempts
  WHERE email = lower(trim(p_email))
    AND attempted_at > now() - interval '24 hours';

  IF v_daily_email_attempts >= v_max_attempts_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'message', 'Maximum daily password reset attempts exceeded. Please try again tomorrow or contact support.'
    );
  END IF;

  -- If IP address provided, check IP-based rate limit
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_ip_attempts
    FROM public.password_reset_attempts
    WHERE ip_address = p_ip_address
      AND attempted_at > now() - interval '1 hour';

    IF v_ip_attempts >= 10 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'ip_rate_limit_exceeded',
        'message', 'Too many password reset requests from this location. Please try again later.'
      );
    END IF;
  END IF;

  -- Allow the request
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_attempts', GREATEST(v_max_attempts_per_hour - v_hourly_email_attempts, 0)
  );
END;
$$;

-- Function to log password reset attempt
CREATE OR REPLACE FUNCTION public.log_password_reset_attempt(
  p_email text,
  p_ip_address inet DEFAULT NULL,
  p_success boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.password_reset_attempts (email, ip_address, success)
  VALUES (lower(trim(p_email)), p_ip_address, p_success);
END;
$$;

-- Cleanup function to remove old attempts (run daily via cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_password_reset_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_attempts
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.check_password_reset_rate_limit(text, inet) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_password_reset_attempt(text, inet, boolean) TO authenticated;

-- Comment on table and functions
COMMENT ON TABLE public.password_reset_attempts IS 'Tracks password reset attempts for rate limiting';
COMMENT ON FUNCTION public.check_password_reset_rate_limit(text, inet) IS 'Checks if password reset is allowed based on rate limits';
COMMENT ON FUNCTION public.log_password_reset_attempt(text, inet, boolean) IS 'Logs a password reset attempt';
COMMENT ON FUNCTION public.cleanup_old_password_reset_attempts() IS 'Removes password reset attempts older than 30 days';

-- Made with Bob
