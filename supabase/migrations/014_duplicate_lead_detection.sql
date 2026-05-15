-- Duplicate Lead Detection
-- Prevents duplicate leads based on email within the same tenant
-- Also provides functions to find potential duplicates

-- Add unique constraint on email within tenant
-- This prevents exact email duplicates within the same tenant
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_email_tenant_unique;

ALTER TABLE leads
ADD CONSTRAINT leads_email_tenant_unique 
UNIQUE (email, tenant_id);

-- Create index for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_leads_email_tenant 
ON leads(email, tenant_id) 
WHERE email IS NOT NULL;

-- Create index for phone-based duplicate detection
CREATE INDEX IF NOT EXISTS idx_leads_phone_tenant 
ON leads(phone, tenant_id) 
WHERE phone IS NOT NULL AND phone != '';

-- Function to find potential duplicate leads
CREATE OR REPLACE FUNCTION find_duplicate_leads(
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
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
      -- Exact email match (case-insensitive)
      LOWER(l.email) = LOWER(p_email)
      OR
      -- Exact phone match
      (p_phone IS NOT NULL AND p_phone != '' AND l.phone = p_phone)
      OR
      -- Similar email (same username part)
      LOWER(l.email) LIKE '%' || LOWER(SPLIT_PART(p_email, '@', 1)) || '%'
    )
  ORDER BY confidence DESC, l.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for duplicates before insert/update
CREATE OR REPLACE FUNCTION check_lead_duplicate()
RETURNS TRIGGER AS $$
DECLARE
  duplicate_count INTEGER;
  duplicate_lead_id UUID;
BEGIN
  -- Only check for new leads or when email/phone changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.email != OLD.email OR NEW.phone != OLD.phone)) THEN
    
    -- Check for exact email match within tenant
    SELECT COUNT(*), MAX(id) INTO duplicate_count, duplicate_lead_id
    FROM leads
    WHERE
      tenant_id = NEW.tenant_id
      AND LOWER(email) = LOWER(NEW.email)
      AND id != NEW.id;

    IF duplicate_count > 0 THEN
      -- Log the duplicate attempt
      RAISE NOTICE 'Duplicate lead detected: email % already exists for tenant %', NEW.email, NEW.tenant_id;
      
      -- For INSERT, prevent the duplicate
      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Duplicate lead: A lead with email % already exists in this workspace', NEW.email
          USING HINT = 'Check existing leads before creating new ones',
                ERRCODE = '23505'; -- unique_violation
      END IF;
      
      -- For UPDATE, allow if it's the same lead
      IF TG_OP = 'UPDATE' AND NEW.id = OLD.id THEN
        RETURN NEW;
      END IF;
    END IF;

    -- Check for phone duplicates (warning only, not blocking)
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
      SELECT COUNT(*) INTO duplicate_count
      FROM leads
      WHERE 
        tenant_id = NEW.tenant_id
        AND phone = NEW.phone
        AND id != NEW.id;

      IF duplicate_count > 0 THEN
        RAISE NOTICE 'Potential duplicate: phone % already exists for tenant %', NEW.phone, NEW.tenant_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for duplicate detection
DROP TRIGGER IF EXISTS check_lead_duplicate_trigger ON leads;

CREATE TRIGGER check_lead_duplicate_trigger
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION check_lead_duplicate();

-- Function to merge duplicate leads
CREATE OR REPLACE FUNCTION merge_duplicate_leads(
  p_keep_lead_id UUID,
  p_merge_lead_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  keep_lead RECORD;
  merge_lead RECORD;
BEGIN
  -- Get both leads
  SELECT * INTO keep_lead FROM leads WHERE id = p_keep_lead_id;
  SELECT * INTO merge_lead FROM leads WHERE id = p_merge_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'One or both leads not found';
  END IF;

  -- Ensure both leads are in the same tenant
  IF keep_lead.tenant_id != merge_lead.tenant_id THEN
    RAISE EXCEPTION 'Cannot merge leads from different tenants';
  END IF;

  -- Transfer activities
  UPDATE activities
  SET lead_id = p_keep_lead_id
  WHERE lead_id = p_merge_lead_id;

  -- Transfer tasks
  UPDATE tasks
  SET lead_id = p_keep_lead_id
  WHERE lead_id = p_merge_lead_id;

  -- Transfer appointments
  UPDATE appointments
  SET lead_id = p_keep_lead_id
  WHERE lead_id = p_merge_lead_id;

  -- Merge notes (append merge_lead notes to keep_lead)
  IF merge_lead.notes IS NOT NULL AND merge_lead.notes != '' THEN
    UPDATE leads
    SET notes = COALESCE(notes || E'\n\n--- Merged from duplicate lead ---\n' || merge_lead.notes, merge_lead.notes)
    WHERE id = p_keep_lead_id;
  END IF;

  -- Merge tags (combine unique tags)
  UPDATE leads
  SET tags = ARRAY(
    SELECT DISTINCT unnest(COALESCE(keep_lead.tags, ARRAY[]::TEXT[]) || COALESCE(merge_lead.tags, ARRAY[]::TEXT[]))
  )
  WHERE id = p_keep_lead_id;

  -- Update keep_lead with better data from merge_lead if needed
  UPDATE leads
  SET
    -- Keep the earlier created_at
    created_at = LEAST(keep_lead.created_at, merge_lead.created_at),
    -- Keep the higher score
    score = GREATEST(keep_lead.score, merge_lead.score),
    -- Keep hot status if either is hot
    hot = keep_lead.hot OR merge_lead.hot,
    -- Keep the higher budget
    budget = GREATEST(keep_lead.budget, merge_lead.budget),
    -- Merge requirements (keep non-null values)
    requirements = COALESCE(
      jsonb_build_object(
        'bedrooms', COALESCE((keep_lead.requirements->>'bedrooms')::INTEGER, (merge_lead.requirements->>'bedrooms')::INTEGER),
        'bathrooms', COALESCE((keep_lead.requirements->>'bathrooms')::INTEGER, (merge_lead.requirements->>'bathrooms')::INTEGER),
        'area', COALESCE((keep_lead.requirements->>'area')::INTEGER, (merge_lead.requirements->>'area')::INTEGER),
        'location', COALESCE(keep_lead.requirements->>'location', merge_lead.requirements->>'location')
      ),
      keep_lead.requirements,
      merge_lead.requirements
    ),
    updated_at = NOW()
  WHERE id = p_keep_lead_id;

  -- Log the merge as an activity
  INSERT INTO activities (lead_id, type, title, description, user_id, tenant_id)
  VALUES (
    p_keep_lead_id,
    'note',
    'Lead Merged',
    'Merged duplicate lead: ' || merge_lead.name || ' (' || merge_lead.email || ')',
    p_user_id,
    keep_lead.tenant_id
  );

  -- Soft delete the merged lead (or hard delete if preferred)
  DELETE FROM leads WHERE id = p_merge_lead_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION find_duplicate_leads IS 'Finds potential duplicate leads based on email and phone';
COMMENT ON FUNCTION check_lead_duplicate IS 'Trigger function to prevent duplicate leads';
COMMENT ON FUNCTION merge_duplicate_leads IS 'Merges two duplicate leads, keeping one and transferring all data';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_duplicate_leads TO authenticated;
GRANT EXECUTE ON FUNCTION merge_duplicate_leads TO authenticated;

-- Made with Bob
