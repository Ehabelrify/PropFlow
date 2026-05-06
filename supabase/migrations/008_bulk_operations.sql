-- Batch operation for assigning multiple leads
CREATE OR REPLACE FUNCTION public.bulk_assign_leads(
  _lead_ids uuid[],
  _assigned_to uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.leads
  SET assigned_to = _assigned_to
  WHERE id = ANY(_lead_ids);
$$;

-- Batch operation for moving multiple leads to a stage
CREATE OR REPLACE FUNCTION public.bulk_move_leads_stage(
  _lead_ids uuid[],
  _stage lead_stage
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.leads
  SET stage = _stage
  WHERE id = ANY(_lead_ids);
$$;

-- Made with Bob
