-- 2026-09-09 review, finding C-1 (Critical): every public_* view is a simple,
-- owner-executed projection. Supabase's default privileges grant ALL on new
-- relations to anon/authenticated, and PostgreSQL makes simple views
-- auto-updatable, so INSERT/UPDATE/DELETE through the views reached the base
-- tables as the view owner and bypassed every RLS policy. The explicit
-- `GRANT SELECT` in 20260712000000 never removed the write privileges.
--
-- This migration:
--   1. strips every non-SELECT privilege from the public projections,
--   2. strips dormant write grants from base tables (all writes are server-side),
--   3. makes new relations and functions deny-by-default for anon/authenticated
--      so the same footgun cannot recur,
--   4. cleans up SECURITY DEFINER helpers flagged by the review,
--   5. drops the unused discrete-log objects and the placeholder authority row,
--   6. hides authority login events from the public audit projection,
--   7. stops storing client-authored details on authentication audit rows.

-- 1. Views: SELECT only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.public_votes,
     public.public_elections,
     public.public_participants,
     public.public_delegations,
     public.public_nullifications,
     public.public_nullification_accumulators,
     public.public_election_authorities,
     public.public_authority_audit_events,
     public.public_tallies,
     public.public_election_activity
  FROM anon, authenticated;

-- 2. Base tables: every client write already goes through a service-role RPC
--    or an edge function, and every remaining write policy is `false`. Drop the
--    dormant default grants so RLS is no longer the only thing in the way.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- 3. Deny-by-default for everything created after this point. Every existing
--    grant in this repository is explicit, so nothing depends on the defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 4. SECURITY DEFINER hygiene.
ALTER FUNCTION public.get_authority_id_for_current_user()
  SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_authority_id_for_current_user()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_authority_id_for_current_user()
  TO authenticated, service_role;

-- Orphaned since 20260820000000 dropped the policies that used it.
DROP FUNCTION IF EXISTS public.is_current_user_election_authority(uuid);

-- 5. The discrete-log lookup moved in-process (elGamalTallyService.ts); the
--    table and its anon-callable SECURITY DEFINER wiper are dead surface.
DROP FUNCTION IF EXISTS public.clear_discrete_log_table();
DROP FUNCTION IF EXISTS public.get_discrete_log(text);
DROP FUNCTION IF EXISTS public.initialize_discrete_log_table(integer);
DROP TABLE IF EXISTS public.discrete_log_lookup;

-- The placeholder "Default Election Authority" row carries the base point as
-- its public key (private key = 1). Edge functions already refuse it; remove
-- it unless some historical election still references it.
DELETE FROM public.election_authorities authority
WHERE authority.name = 'Default Election Authority'
  AND authority.public_key_x =
    '5299619240641551281634865583518297030282874472190772894086521144482721001553'
  AND authority.auth_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.elections election
    WHERE election.authority_id = authority.id
  );

-- 6. Authentication events carry a NULL election_id and only reveal when the
--    authority signed in. Keep them in the private audit log, not the public view.
CREATE OR REPLACE VIEW public.public_authority_audit_events AS
SELECT
  id,
  election_id,
  action,
  performed_by,
  performed_at
FROM public.election_authority_audit_log
WHERE election_id IS NOT NULL;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.public_authority_audit_events FROM anon, authenticated;
GRANT SELECT ON public.public_authority_audit_events TO anon, authenticated;

-- 7. Authentication audit rows are authored server-side only. The parameter is
--    kept so existing clients keep working, but its contents are ignored.
CREATE OR REPLACE FUNCTION public.record_authority_authentication(
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authority_name text;
BEGIN
  SELECT name INTO authority_name
  FROM public.election_authorities
  WHERE auth_user_id = auth.uid();

  IF authority_name IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUTHORITY_REQUIRED';
  END IF;

  INSERT INTO public.election_authority_audit_log (
    election_id,
    action,
    performed_by,
    auth_user_id,
    details
  ) VALUES (
    NULL,
    'AUTHENTICATION',
    authority_name,
    auth.uid(),
    jsonb_build_object('source', 'supabase_auth', 'recorded_at', now())
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_authority_authentication(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_authority_authentication(jsonb)
  TO authenticated;
