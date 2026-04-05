-- VTX-008: Fix audit logging for authority actions.
--
-- Problems:
--   1. No INSERT policy → all audit writes silently fail under RLS.
--   2. election_id is UUID NOT NULL → the AUTHENTICATION event passes
--      'GLOBAL' which fails type validation, so auth audits never persist.
--
-- Fixes:
--   1. Make election_id nullable (NULL = system-wide / non-election event).
--   2. Add INSERT policy for authenticated Supabase Auth users.
--   3. Add auth_user_id column for traceability.

-- Allow NULL election_id for system-level events (e.g. AUTHENTICATION)
ALTER TABLE public.election_authority_audit_log
  ALTER COLUMN election_id DROP NOT NULL;

-- Record which auth user performed the action (backfill-safe as nullable)
ALTER TABLE public.election_authority_audit_log
  ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Authenticated users can insert audit entries.
-- We scope to users who are linked authorities via the helper from VTX-004.
CREATE POLICY "Authenticated authorities can insert audit logs"
  ON public.election_authority_audit_log
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.get_authority_id_for_current_user() IS NOT NULL
  );
