-- M2: discrete_log_lookup allowed open INSERT, so anyone with the anon key
-- could plant incorrect point->value mappings and corrupt decrypted tallies
-- for points not yet cached (tally-decode poisoning). The tally path now
-- computes discrete logs locally and treats this table as a server-seeded
-- cache only; client inserts are blocked.
--
-- The table is wiped because rows inserted while the policy was open cannot
-- be trusted. (Live state on 2026-06-11 held exactly the standard 0..100
-- seed, but the wipe keeps the guarantee unconditional; the seed is cheap to
-- recompute.)

DROP POLICY IF EXISTS "Anyone can insert discrete log lookup" ON public.discrete_log_lookup;

CREATE POLICY "No direct client inserts into discrete_log_lookup"
  ON public.discrete_log_lookup
  FOR INSERT
  WITH CHECK (false);

TRUNCATE public.discrete_log_lookup;
