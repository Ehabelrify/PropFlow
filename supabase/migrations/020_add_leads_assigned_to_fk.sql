-- ============================================================
-- Migration 020: Add missing FK constraint on leads.assigned_to
-- The `profiles!assigned_to` join in the app requires this FK
-- Without it, PostgREST returns 400 for the entire query
-- ============================================================

-- Add the missing FK constraint
-- ON DELETE SET NULL ensures users can be deleted without
-- having to reassign all their leads first
ALTER TABLE public.leads
  ADD CONSTRAINT leads_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ============================================================
-- Migration Complete
-- ============================================================
