-- ============================================================
-- Migration 020: Add missing FK constraint on leads.assigned_to
-- The `profiles!assigned_to` join in the app requires this FK
-- Without it, PostgREST returns 400 for the entire query
-- ============================================================

-- Add the missing FK constraint if it doesn't already exist
-- ON DELETE SET NULL ensures users can be deleted without
-- having to reassign all their leads first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leads_assigned_to_fkey'
      AND table_schema = 'public'
      AND table_name = 'leads'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_assigned_to_fkey
      FOREIGN KEY (assigned_to)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Migration Complete
-- ============================================================
