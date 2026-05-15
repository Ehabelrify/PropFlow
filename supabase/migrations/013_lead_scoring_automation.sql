-- Lead Scoring Automation
-- Automatically calculates and updates lead scores based on activities and lead data

-- Function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  lead_record RECORD;
  activity_count INTEGER;
  call_count INTEGER;
  appointment_count INTEGER;
  days_since_activity INTEGER;
  engagement_score INTEGER := 0;
  stage_score INTEGER := 0;
  budget_score INTEGER := 0;
  profile_score INTEGER := 0;
  total_score INTEGER := 0;
BEGIN
  -- Get lead data
  SELECT * INTO lead_record FROM leads WHERE id = lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate days since last activity
  days_since_activity := EXTRACT(DAY FROM (NOW() - lead_record.last_activity_at));

  -- Get activity counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'call'),
    COUNT(*) FILTER (WHERE type = 'appointment')
  INTO activity_count, call_count, appointment_count
  FROM activities
  WHERE activities.lead_id = lead_record.id;

  -- ENGAGEMENT SCORE (0-40 points)
  -- Activity recency (0-15 points)
  IF days_since_activity = 0 THEN
    engagement_score := engagement_score + 15;
  ELSIF days_since_activity <= 1 THEN
    engagement_score := engagement_score + 12;
  ELSIF days_since_activity <= 3 THEN
    engagement_score := engagement_score + 10;
  ELSIF days_since_activity <= 7 THEN
    engagement_score := engagement_score + 7;
  ELSIF days_since_activity <= 14 THEN
    engagement_score := engagement_score + 4;
  ELSIF days_since_activity <= 30 THEN
    engagement_score := engagement_score + 2;
  END IF;

  -- Activity frequency (0-15 points)
  IF activity_count >= 10 THEN
    engagement_score := engagement_score + 15;
  ELSIF activity_count >= 7 THEN
    engagement_score := engagement_score + 12;
  ELSIF activity_count >= 5 THEN
    engagement_score := engagement_score + 10;
  ELSIF activity_count >= 3 THEN
    engagement_score := engagement_score + 7;
  ELSIF activity_count >= 1 THEN
    engagement_score := engagement_score + 4;
  END IF;

  -- Activity quality (0-10 points)
  IF appointment_count >= 2 THEN
    engagement_score := engagement_score + 10;
  ELSIF appointment_count >= 1 THEN
    engagement_score := engagement_score + 7;
  ELSIF call_count >= 3 THEN
    engagement_score := engagement_score + 5;
  ELSIF call_count >= 1 THEN
    engagement_score := engagement_score + 3;
  END IF;

  -- Cap engagement score at 40
  engagement_score := LEAST(engagement_score, 40);

  -- STAGE PROGRESS SCORE (0-25 points)
  stage_score := CASE lead_record.stage
    WHEN 'new' THEN 5
    WHEN 'contacted' THEN 10
    WHEN 'qualified' THEN 15
    WHEN 'viewing' THEN 20
    WHEN 'negotiation' THEN 25
    WHEN 'won' THEN 25
    WHEN 'lost' THEN 0
    ELSE 0
  END;

  -- BUDGET QUALIFICATION SCORE (0-20 points)
  IF lead_record.budget > 0 THEN
    -- Assume average property price of 500,000 (can be adjusted)
    DECLARE
      budget_ratio NUMERIC;
      avg_price NUMERIC := 500000;
    BEGIN
      budget_ratio := lead_record.budget::NUMERIC / avg_price;
      
      IF budget_ratio >= 1.5 THEN
        budget_score := 15;
      ELSIF budget_ratio >= 1.0 THEN
        budget_score := 12;
      ELSIF budget_ratio >= 0.75 THEN
        budget_score := 9;
      ELSIF budget_ratio >= 0.5 THEN
        budget_score := 6;
      ELSE
        budget_score := 3;
      END IF;
      
      -- Budget specificity bonus
      budget_score := budget_score + 5;
    END;
  END IF;

  -- Cap budget score at 20
  budget_score := LEAST(budget_score, 20);

  -- PROFILE COMPLETENESS SCORE (0-15 points)
  -- Basic info (always 3 points if lead exists)
  profile_score := 3;

  -- Requirements (6 points total)
  IF lead_record.requirements IS NOT NULL THEN
    IF (lead_record.requirements->>'bedrooms') IS NOT NULL THEN
      profile_score := profile_score + 1.5;
    END IF;
    IF (lead_record.requirements->>'bathrooms') IS NOT NULL THEN
      profile_score := profile_score + 1.5;
    END IF;
    IF (lead_record.requirements->>'area') IS NOT NULL THEN
      profile_score := profile_score + 1.5;
    END IF;
    IF (lead_record.requirements->>'location') IS NOT NULL THEN
      profile_score := profile_score + 1.5;
    END IF;
  END IF;

  -- Property interest (3 points)
  IF lead_record.property_interest IS NOT NULL THEN
    profile_score := profile_score + 3;
  END IF;

  -- Notes (3 points)
  IF lead_record.notes IS NOT NULL AND LENGTH(lead_record.notes) > 20 THEN
    profile_score := profile_score + 3;
  END IF;

  -- Cap profile score at 15
  profile_score := LEAST(profile_score, 15);

  -- CALCULATE TOTAL SCORE
  total_score := engagement_score + stage_score + budget_score + profile_score;
  total_score := LEAST(GREATEST(total_score, 0), 100); -- Clamp to 0-100

  -- Determine if lead should be marked as hot
  DECLARE
    should_be_hot BOOLEAN := FALSE;
  BEGIN
    -- High score = hot
    IF total_score >= 75 THEN
      should_be_hot := TRUE;
    END IF;

    -- In negotiation = hot
    IF lead_record.stage = 'negotiation' THEN
      should_be_hot := TRUE;
    END IF;

    -- Recent high engagement = hot
    IF engagement_score >= 30 AND days_since_activity <= 1 THEN
      should_be_hot := TRUE;
    END IF;

    -- Update lead with new score and hot status
    UPDATE leads
    SET 
      score = total_score,
      hot = should_be_hot,
      updated_at = NOW()
    WHERE id = lead_id;
  END;

  RETURN total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to recalculate score when lead is updated
CREATE OR REPLACE FUNCTION trigger_recalculate_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate score for the lead
  PERFORM calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to recalculate score when activity is added/updated/deleted
CREATE OR REPLACE FUNCTION trigger_recalculate_lead_score_from_activity()
RETURNS TRIGGER AS $$
DECLARE
  affected_lead_id UUID;
BEGIN
  -- Determine which lead to update
  IF TG_OP = 'DELETE' THEN
    affected_lead_id := OLD.lead_id;
  ELSE
    affected_lead_id := NEW.lead_id;
  END IF;

  -- Recalculate score for the lead
  PERFORM calculate_lead_score(affected_lead_id);
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS recalculate_lead_score_on_update ON leads;
DROP TRIGGER IF EXISTS recalculate_lead_score_on_activity_change ON activities;

-- Create trigger on leads table
CREATE TRIGGER recalculate_lead_score_on_update
  AFTER UPDATE OF stage, budget, requirements, notes, property_interest, last_activity_at
  ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- Create trigger on activities table
CREATE TRIGGER recalculate_lead_score_on_activity_change
  AFTER INSERT OR UPDATE OR DELETE
  ON activities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score_from_activity();

-- Recalculate scores for all existing leads
DO $$
DECLARE
  lead_rec RECORD;
BEGIN
  FOR lead_rec IN SELECT id FROM leads LOOP
    PERFORM calculate_lead_score(lead_rec.id);
  END LOOP;
END $$;

-- Add comment
COMMENT ON FUNCTION calculate_lead_score IS 'Calculates lead score (0-100) based on engagement, stage, budget, and profile completeness';

-- Made with Bob
