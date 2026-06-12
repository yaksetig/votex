-- M1: delegations INSERT/UPDATE policies were unconditionally true and the
-- client supplied delegator_id, so anyone with the anon key could forge a
-- delegation on behalf of an arbitrary voter or revoke a victim's active
-- delegation. Writes now go through the delegation-write edge function, which
-- derives delegator_id from a validated World ID session. Public SELECT stays
-- (ciphertexts are ElGamal-encrypted; observers learn only that a delegation
-- exists).

DROP POLICY IF EXISTS "Authenticated users can insert delegations" ON public.delegations;
DROP POLICY IF EXISTS "Authenticated users can update delegations" ON public.delegations;

CREATE POLICY "No direct client inserts into delegations"
  ON public.delegations
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to delegations"
  ON public.delegations
  FOR UPDATE
  USING (false)
  WITH CHECK (false);
