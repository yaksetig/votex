-- H1: election_participants was fully client-writable (INSERT/UPDATE/DELETE all
-- unconditionally allowed since 20250603050531). Any holder of the public anon
-- key could overwrite another voter's public key (permanently blocking their
-- nullifications, which are verified against the stored key), delete eligible
-- voters, or inject Sybil participants.
--
-- Registration now goes through the register-participant edge function, which
-- validates a World ID session and enforces that the submitted key matches the
-- caller's registered world_id_keypairs binding. Direct client writes are
-- blocked; public SELECT stays (participant keys are public inputs to the
-- nullification protocol).

DROP POLICY IF EXISTS "Allow participant registration" ON public.election_participants;
DROP POLICY IF EXISTS "Allow updating own participation" ON public.election_participants;
DROP POLICY IF EXISTS "Allow deleting own participation" ON public.election_participants;

CREATE POLICY "No direct client inserts into election_participants"
  ON public.election_participants
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to election_participants"
  ON public.election_participants
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client deletes from election_participants"
  ON public.election_participants
  FOR DELETE
  USING (false);
