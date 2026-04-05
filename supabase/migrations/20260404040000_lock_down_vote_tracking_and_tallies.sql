-- VTX-006: vote tracking and tally tables must not accept direct client writes.
-- Reads remain public, but inserts/updates/deletes must go through controlled
-- server-side logic.

DROP POLICY IF EXISTS "Anyone can insert yes_votes" ON public.yes_votes;
DROP POLICY IF EXISTS "Anyone can update yes_votes" ON public.yes_votes;
DROP POLICY IF EXISTS "Anyone can insert no_votes" ON public.no_votes;
DROP POLICY IF EXISTS "Anyone can update no_votes" ON public.no_votes;
DROP POLICY IF EXISTS "Anyone can insert election tallies" ON public.election_tallies;
DROP POLICY IF EXISTS "Anyone can update election tallies" ON public.election_tallies;

CREATE POLICY "No direct client inserts into yes_votes"
  ON public.yes_votes
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to yes_votes"
  ON public.yes_votes
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client deletes from yes_votes"
  ON public.yes_votes
  FOR DELETE
  USING (false);

CREATE POLICY "No direct client inserts into no_votes"
  ON public.no_votes
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to no_votes"
  ON public.no_votes
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client deletes from no_votes"
  ON public.no_votes
  FOR DELETE
  USING (false);

CREATE POLICY "No direct client inserts into election_tallies"
  ON public.election_tallies
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to election_tallies"
  ON public.election_tallies
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client deletes from election_tallies"
  ON public.election_tallies
  FOR DELETE
  USING (false);
