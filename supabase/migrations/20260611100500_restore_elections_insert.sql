-- Corrective migration. 20260611100400 tightened the elections INSERT policy to
-- authority-only, but open election creation was never a flagged vulnerability
-- and that change breaks the intended product flow: World ID voters create
-- elections from the public Elections page using the anon key (they authenticate
-- via the custom worldid-session, not Supabase Auth, so auth.uid() is null and
-- get_authority_id_for_current_user() returns null for them). Restore the prior
-- behavior. Election UPDATE/DELETE remain authority-bound (20260404030000), and
-- the genuine fixes from 20260611100400 (votes INSERT lockdown, dropping the
-- unvalidated insert_vote() RPC and the legacy keypairs table) stay in place.

DROP POLICY IF EXISTS "Election authorities can create elections" ON public.elections;

CREATE POLICY "Authenticated users can create elections"
  ON public.elections
  FOR INSERT
  WITH CHECK (true);
