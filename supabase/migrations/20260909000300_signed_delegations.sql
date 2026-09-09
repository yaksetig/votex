-- 2026-09-09 review, finding F1 (frontend) / M-1: delegations were authorised
-- by the voter session alone, and the tally zeroes a delegator's own ballot.
-- A leaked session (or, before 20260909000100, a leaked verifier) could
-- therefore silently remove any voter's vote. Every create/revoke now carries
-- an EdDSA-Poseidon signature by the delegator's registered voting key over a
-- domain-separated message; delegation-write verifies it and the signatures
-- are stored with the record for auditability (delegator_signature for the
-- create, revocation_signature for an explicit revoke; a replacement create
-- revokes the previous row without a revocation signature of its own).

ALTER TABLE public.delegations
  ADD COLUMN IF NOT EXISTS delegator_signature text,
  ADD COLUMN IF NOT EXISTS revocation_signature text;

DROP FUNCTION IF EXISTS public.write_delegation_atomic(text, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.write_delegation_atomic(
  p_action text,
  p_election_id uuid,
  p_delegator_id text,
  p_c1_x text DEFAULT NULL,
  p_c1_y text DEFAULT NULL,
  p_c2_x text DEFAULT NULL,
  p_c2_y text DEFAULT NULL,
  p_signature text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delegation_id uuid;
  election_closed boolean;
BEGIN
  IF p_action NOT IN ('create', 'revoke') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'UNSUPPORTED_ACTION';
  END IF;

  IF p_signature IS NULL OR length(p_signature) = 0 OR length(p_signature) > 2048 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SIGNATURE_REQUIRED';
  END IF;

  SELECT closed_manually_at IS NOT NULL OR end_date <= now()
  INTO election_closed
  FROM public.elections
  WHERE id = p_election_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ELECTION_NOT_FOUND';
  END IF;

  IF election_closed THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ELECTION_CLOSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.election_participants
    WHERE election_id = p_election_id AND participant_id = p_delegator_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTICIPANT_REQUIRED';
  END IF;

  UPDATE public.delegations
  SET status = 'revoked',
      revoked_at = now(),
      revocation_signature = CASE WHEN p_action = 'revoke' THEN p_signature ELSE revocation_signature END
  WHERE election_id = p_election_id
    AND delegator_id = p_delegator_id
    AND status = 'active'
  RETURNING id INTO delegation_id;

  IF p_action = 'revoke' THEN
    RETURN delegation_id;
  END IF;

  IF p_c1_x IS NULL OR p_c1_y IS NULL OR p_c2_x IS NULL OR p_c2_y IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_CIPHERTEXT';
  END IF;

  INSERT INTO public.delegations (
    election_id,
    delegator_id,
    delegate_ct_c1_x,
    delegate_ct_c1_y,
    delegate_ct_c2_x,
    delegate_ct_c2_y,
    delegator_signature
  ) VALUES (
    p_election_id,
    p_delegator_id,
    p_c1_x,
    p_c1_y,
    p_c2_x,
    p_c2_y,
    p_signature
  ) RETURNING id INTO delegation_id;

  RETURN delegation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_delegation_atomic(text, uuid, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_delegation_atomic(text, uuid, text, text, text, text, text, text)
  TO service_role;
