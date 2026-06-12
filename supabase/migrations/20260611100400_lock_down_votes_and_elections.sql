-- Live-drift remediation discovered during the 2026-06-11 schema audit.
--
-- 1. votes INSERT was open ("Authenticated users can vote once per election"
--    WITH CHECK (true) — the name lied) and insert_vote() did no validation,
--    so anyone with the anon key could insert a forged or blocking vote under
--    any voter id (the UNIQUE(election_id, voter) constraint then locks the
--    real voter out). Votes are now written by the vote-tracking-write edge
--    function (cast-vote action), which validates the World ID session,
--    verifies the EdDSA vote signature against the voter's registered key,
--    and checks the election is open.
--
-- 2. elections INSERT: this migration originally gated creation on the caller
--    being an authenticated authority, but that was reverted by
--    20260611100500 because open creation is the intended product flow and was
--    not a flagged vulnerability. The policy below is superseded; see that
--    migration.
--
-- 3. The legacy pre-World-ID keypairs table (open INSERT, referenced only by
--    dead code) is dropped.

DROP POLICY IF EXISTS "Authenticated users can vote once per election" ON public.votes;

CREATE POLICY "No direct client inserts into votes"
  ON public.votes
  FOR INSERT
  WITH CHECK (false);

DROP FUNCTION IF EXISTS public.insert_vote(uuid, text, text, text, text, bigint);

DROP POLICY IF EXISTS "Authenticated users can create elections" ON public.elections;

CREATE POLICY "Election authorities can create elections"
  ON public.elections
  FOR INSERT
  WITH CHECK (public.get_authority_id_for_current_user() IS NOT NULL);

DROP TABLE IF EXISTS public.keypairs;
