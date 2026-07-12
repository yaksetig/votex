-- Pre-production hardening without changing any cryptographic payloads.
--
-- This migration closes direct election creation, makes vote/delegation/tally
-- persistence atomic, and exposes deliberate public audit views instead of the
-- internal votes table. All SECURITY DEFINER functions are service-role only.

-- New elections are created by the create-election edge function after it
-- validates the custom World ID session and resolves FIXED_AUTHORITY_ID.
DROP POLICY IF EXISTS "Authenticated users can create elections" ON public.elections;
DROP POLICY IF EXISTS "Election authorities can create elections" ON public.elections;
DROP POLICY IF EXISTS "No direct client inserts into elections" ON public.elections;

CREATE POLICY "No direct client inserts into elections"
  ON public.elections
  FOR INSERT
  WITH CHECK (false);

-- A binary election cannot use the same label for both choices.
ALTER TABLE public.elections
  DROP CONSTRAINT IF EXISTS elections_distinct_options;
ALTER TABLE public.elections
  ADD CONSTRAINT elections_distinct_options
  CHECK (lower(btrim(option1)) <> lower(btrim(option2)));

-- Historical datasets may contain repeated participant rows. They are
-- interchangeable because protocol state references the participant id/key,
-- not the row UUID, so retain the earliest row before enforcing uniqueness.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY election_id, participant_id
           ORDER BY joined_at, id
         ) AS position
  FROM public.election_participants
)
DELETE FROM public.election_participants p
USING ranked r
WHERE p.id = r.id AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_election_participants_identity
  ON public.election_participants (election_id, participant_id);

CREATE INDEX IF NOT EXISTS idx_votes_election_created
  ON public.votes (election_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_election_choice
  ON public.votes (election_id, choice);
CREATE INDEX IF NOT EXISTS idx_delegations_election_status
  ON public.delegations (election_id, status);
CREATE INDEX IF NOT EXISTS idx_election_tallies_election_processed
  ON public.election_tallies (election_id, processed_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_started_election_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.votes WHERE election_id = OLD.id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ELECTION_ALREADY_STARTED';
    END IF;

    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.option1 IS DISTINCT FROM OLD.option1
       OR NEW.option2 IS DISTINCT FROM OLD.option2
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.authority_id IS DISTINCT FROM OLD.authority_id
       OR NEW.creator IS DISTINCT FROM OLD.creator THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ELECTION_ALREADY_STARTED';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_started_election ON public.elections;
CREATE TRIGGER protect_started_election
  BEFORE UPDATE OR DELETE ON public.elections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_started_election_immutability();

CREATE OR REPLACE FUNCTION public.close_election_atomic(p_election_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authority public.election_authorities%ROWTYPE;
  closed_title text;
  changed boolean := false;
BEGIN
  SELECT * INTO authority
  FROM public.election_authorities
  WHERE auth_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUTHORITY_REQUIRED';
  END IF;

  UPDATE public.elections
  SET status = 'closed_manually',
      closed_manually_at = now(),
      last_modified_by = authority.name
  WHERE id = p_election_id
    AND authority_id = authority.id
    AND closed_manually_at IS NULL
    AND end_date > now()
  RETURNING title INTO closed_title;

  changed := FOUND;
  IF changed THEN
    INSERT INTO public.election_authority_audit_log (
      election_id,
      action,
      performed_by,
      auth_user_id,
      details
    ) VALUES (
      p_election_id,
      'CLOSE_ELECTION',
      authority.name,
      auth.uid(),
      jsonb_build_object('reason', 'Manual closure by election authority')
    );
  END IF;

  RETURN changed OR EXISTS (
    SELECT 1 FROM public.elections
    WHERE id = p_election_id
      AND authority_id = authority.id
      AND closed_manually_at IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_election_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_election_atomic(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.election_creation_requests (
  creator text NOT NULL,
  idempotency_key uuid NOT NULL,
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (creator, idempotency_key)
);

ALTER TABLE public.election_creation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to election creation requests"
  ON public.election_creation_requests FOR SELECT USING (false);

CREATE OR REPLACE FUNCTION public.create_election_atomic(
  p_creator text,
  p_authority_id uuid,
  p_title text,
  p_description text,
  p_option1 text,
  p_option2 text,
  p_end_date timestamptz,
  p_idempotency_key uuid
) RETURNS public.elections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_election public.elections%ROWTYPE;
  existing_election_id uuid;
BEGIN
  SELECT election_id INTO existing_election_id
  FROM public.election_creation_requests
  WHERE creator = p_creator AND idempotency_key = p_idempotency_key;

  IF existing_election_id IS NOT NULL THEN
    SELECT * INTO created_election
    FROM public.elections
    WHERE id = existing_election_id;
    RETURN created_election;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.election_authorities
    WHERE id = p_authority_id AND auth_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FIXED_AUTHORITY_UNAVAILABLE';
  END IF;

  INSERT INTO public.elections (
    title,
    description,
    option1,
    option2,
    creator,
    end_date,
    authority_id,
    status
  ) VALUES (
    p_title,
    p_description,
    p_option1,
    p_option2,
    p_creator,
    p_end_date,
    p_authority_id,
    'active'
  ) RETURNING * INTO created_election;

  INSERT INTO public.election_creation_requests (
    creator, idempotency_key, election_id
  ) VALUES (
    p_creator, p_idempotency_key, created_election.id
  );

  RETURN created_election;
EXCEPTION WHEN unique_violation THEN
  SELECT e.* INTO created_election
  FROM public.election_creation_requests r
  JOIN public.elections e ON e.id = r.election_id
  WHERE r.creator = p_creator AND r.idempotency_key = p_idempotency_key;
  RETURN created_election;
END;
$$;

REVOKE ALL ON FUNCTION public.create_election_atomic(text, uuid, text, text, text, text, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_election_atomic(text, uuid, text, text, text, text, timestamptz, uuid)
  TO service_role;

-- Repair legacy vote-tracking drift before the atomic write path becomes the
-- only supported path. Choice labels come from each election, not hard-coded
-- Yes/No strings.
INSERT INTO public.yes_votes (election_id, voter_id, created_at, updated_at)
SELECT v.election_id, v.voter, v.created_at, v.created_at
FROM public.votes v
JOIN public.elections e ON e.id = v.election_id
WHERE v.choice = e.option1
ON CONFLICT (election_id, voter_id) DO NOTHING;

INSERT INTO public.no_votes (election_id, voter_id, created_at, updated_at)
SELECT v.election_id, v.voter, v.created_at, v.created_at
FROM public.votes v
JOIN public.elections e ON e.id = v.election_id
WHERE v.choice = e.option2
ON CONFLICT (election_id, voter_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cast_vote_atomic(
  p_election_id uuid,
  p_voter text,
  p_choice text,
  p_signature text,
  p_timestamp bigint
) RETURNS TABLE (
  receipt_id uuid,
  accepted_at timestamptz,
  recorded_choice text,
  recorded_signature text,
  recorded_timestamp bigint,
  already_existed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_election public.elections%ROWTYPE;
  stored_vote public.votes%ROWTYPE;
  inserted_id uuid;
BEGIN
  SELECT * INTO target_election
  FROM public.elections
  WHERE id = p_election_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ELECTION_NOT_FOUND';
  END IF;

  IF target_election.closed_manually_at IS NOT NULL
     OR target_election.end_date <= now() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ELECTION_CLOSED';
  END IF;

  IF p_choice <> target_election.option1 AND p_choice <> target_election.option2 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_CHOICE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.election_participants
    WHERE election_id = p_election_id AND participant_id = p_voter
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTICIPANT_REQUIRED';
  END IF;

  INSERT INTO public.votes (
    election_id, voter, choice, signature, "timestamp", nullifier
  ) VALUES (
    p_election_id, p_voter, p_choice, p_signature, p_timestamp, NULL
  )
  ON CONFLICT (election_id, voter) DO NOTHING
  RETURNING id INTO inserted_id;

  SELECT * INTO stored_vote
  FROM public.votes
  WHERE election_id = p_election_id AND voter = p_voter;

  IF stored_vote.choice = target_election.option1 THEN
    INSERT INTO public.yes_votes (election_id, voter_id, created_at, updated_at)
    VALUES (p_election_id, p_voter, stored_vote.created_at, stored_vote.created_at)
    ON CONFLICT (election_id, voter_id) DO NOTHING;
  ELSE
    INSERT INTO public.no_votes (election_id, voter_id, created_at, updated_at)
    VALUES (p_election_id, p_voter, stored_vote.created_at, stored_vote.created_at)
    ON CONFLICT (election_id, voter_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT
    stored_vote.id,
    stored_vote.created_at,
    stored_vote.choice,
    stored_vote.signature,
    stored_vote."timestamp",
    inserted_id IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_vote_atomic(uuid, text, text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_vote_atomic(uuid, text, text, text, bigint)
  TO service_role;

CREATE OR REPLACE FUNCTION public.write_delegation_atomic(
  p_action text,
  p_election_id uuid,
  p_delegator_id text,
  p_c1_x text DEFAULT NULL,
  p_c1_y text DEFAULT NULL,
  p_c2_x text DEFAULT NULL,
  p_c2_y text DEFAULT NULL
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
  SET status = 'revoked', revoked_at = now()
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
    delegate_ct_c2_y
  ) VALUES (
    p_election_id,
    p_delegator_id,
    p_c1_x,
    p_c1_y,
    p_c2_x,
    p_c2_y
  ) RETURNING id INTO delegation_id;

  RETURN delegation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_delegation_atomic(text, uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_delegation_atomic(text, uuid, text, text, text, text, text)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.election_tally_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  processed_at timestamptz NOT NULL DEFAULT now(),
  processed_by text NOT NULL,
  replaced_run_id uuid REFERENCES public.election_tally_runs(id),
  result_count integer NOT NULL DEFAULT 0 CHECK (result_count >= 0)
);

ALTER TABLE public.election_tally_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct reads from tally runs"
  ON public.election_tally_runs FOR SELECT USING (false);

ALTER TABLE public.election_tallies
  ADD COLUMN IF NOT EXISTS tally_run_id uuid
  REFERENCES public.election_tally_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tally_runs_election_processed
  ON public.election_tally_runs (election_id, processed_at DESC);

CREATE OR REPLACE FUNCTION public.store_tally_results_atomic(
  p_election_id uuid,
  p_processed_by text,
  p_results jsonb,
  p_replace_existing boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_run_id uuid;
  previous_run_id uuid;
  target_election public.elections%ROWTYPE;
  result_count integer;
BEGIN
  IF jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_TALLY_RESULTS';
  END IF;

  SELECT * INTO target_election
  FROM public.elections
  WHERE id = p_election_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ELECTION_NOT_FOUND';
  END IF;

  IF target_election.closed_manually_at IS NULL
     AND target_election.end_date > now() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ELECTION_STILL_ACTIVE';
  END IF;

  SELECT id INTO previous_run_id
  FROM public.election_tally_runs
  WHERE election_id = p_election_id
  ORDER BY processed_at DESC
  LIMIT 1;

  IF (
    previous_run_id IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.election_tallies WHERE election_id = p_election_id
    )
  ) AND NOT p_replace_existing THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TALLY_ALREADY_PROCESSED';
  END IF;

  CREATE TEMP TABLE tally_input ON COMMIT DROP AS
  SELECT *
  FROM jsonb_to_recordset(p_results) AS item(
    user_id text,
    nullification_count integer,
    vote_nullified boolean,
    vote_weight integer
  );

  IF EXISTS (
    SELECT 1 FROM tally_input
    WHERE user_id IS NULL
       OR nullification_count IS NULL
       OR nullification_count < 0
       OR vote_nullified IS NULL
       OR vote_weight IS NULL
       OR vote_weight < 0
  ) OR EXISTS (
    SELECT user_id FROM tally_input GROUP BY user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_TALLY_RESULTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tally_input input
    WHERE NOT EXISTS (
      SELECT 1 FROM public.yes_votes y
      WHERE y.election_id = p_election_id AND y.voter_id = input.user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.no_votes n
      WHERE n.election_id = p_election_id AND n.voter_id = input.user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.election_participants participant
      WHERE participant.election_id = p_election_id
        AND participant.participant_id = input.user_id
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'UNTRACKED_TALLY_VOTER';
  END IF;

  SELECT count(*) INTO result_count FROM tally_input;

  INSERT INTO public.election_tally_runs (
    election_id, processed_by, replaced_run_id, result_count
  ) VALUES (
    p_election_id, p_processed_by, previous_run_id, result_count
  ) RETURNING id INTO new_run_id;

  UPDATE public.yes_votes y
  SET nullification_count = input.nullification_count,
      nullified = input.vote_nullified,
      updated_at = now()
  FROM tally_input input
  WHERE y.election_id = p_election_id AND y.voter_id = input.user_id;

  UPDATE public.no_votes n
  SET nullification_count = input.nullification_count,
      nullified = input.vote_nullified,
      updated_at = now()
  FROM tally_input input
  WHERE n.election_id = p_election_id AND n.voter_id = input.user_id;

  DELETE FROM public.election_tallies WHERE election_id = p_election_id;

  INSERT INTO public.election_tallies (
    election_id,
    user_id,
    nullification_count,
    vote_nullified,
    vote_weight,
    processed_at,
    processed_by,
    tally_run_id
  )
  SELECT
    p_election_id,
    user_id,
    nullification_count,
    vote_nullified,
    vote_weight,
    now(),
    p_processed_by,
    new_run_id
  FROM tally_input;

  RETURN new_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.store_tally_results_atomic(uuid, text, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_tally_results_atomic(uuid, text, jsonb, boolean)
  TO service_role;

-- Deliberate public audit projection. The receipt id is the canonical vote id.
CREATE OR REPLACE VIEW public.public_votes AS
SELECT
  id AS receipt_id,
  election_id,
  voter AS voter_pseudonym,
  choice,
  signature,
  "timestamp" AS signed_at,
  created_at AS accepted_at
FROM public.votes;

CREATE OR REPLACE VIEW public.public_elections AS
SELECT
  id,
  title,
  description,
  creator,
  end_date,
  created_at,
  option1,
  option2,
  authority_id,
  status,
  closed_manually_at
FROM public.elections;

CREATE OR REPLACE VIEW public.public_participants AS
SELECT
  id,
  election_id,
  participant_id AS voter_pseudonym,
  public_key_x,
  public_key_y,
  joined_at
FROM public.election_participants;

CREATE OR REPLACE VIEW public.public_delegations AS
SELECT
  id,
  election_id,
  delegator_id AS delegator_pseudonym,
  delegate_ct_c1_x,
  delegate_ct_c1_y,
  delegate_ct_c2_x,
  delegate_ct_c2_y,
  status,
  created_at,
  revoked_at
FROM public.delegations;

CREATE OR REPLACE VIEW public.public_nullifications AS
SELECT
  id,
  election_id,
  user_id AS submitter_pseudonym,
  nullifier_ciphertext,
  nullifier_zkp,
  created_at
FROM public.nullifications;

CREATE OR REPLACE VIEW public.public_nullification_accumulators AS
SELECT
  id,
  election_id,
  voter_id AS voter_pseudonym,
  acc_c1_x,
  acc_c1_y,
  acc_c2_x,
  acc_c2_y,
  version,
  created_at,
  updated_at
FROM public.nullification_accumulators;

CREATE OR REPLACE VIEW public.public_election_authorities AS
SELECT
  id,
  name,
  description,
  public_key_x,
  public_key_y,
  created_at,
  updated_at
FROM public.election_authorities;

CREATE OR REPLACE VIEW public.public_authority_audit_events AS
SELECT
  id,
  election_id,
  action,
  performed_by,
  performed_at
FROM public.election_authority_audit_log;

CREATE OR REPLACE VIEW public.public_tallies AS
SELECT
  id,
  election_id,
  user_id AS voter_pseudonym,
  nullification_count,
  vote_nullified,
  vote_weight,
  processed_at,
  tally_run_id
FROM public.election_tallies;

DROP POLICY IF EXISTS "Anyone can view election authorities" ON public.election_authorities;
DROP POLICY IF EXISTS "Allow viewing election authorities" ON public.election_authorities;
CREATE POLICY "Linked authority can read its internal row"
  ON public.election_authorities
  FOR SELECT
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view election audit logs" ON public.election_authority_audit_log;
CREATE POLICY "Linked authority can read audit details"
  ON public.election_authority_audit_log
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.elections election
        JOIN public.election_authorities authority
          ON authority.id = election.authority_id
        WHERE election.id = election_authority_audit_log.election_id
          AND authority.auth_user_id = auth.uid()
      )
    )
  );

REVOKE ALL ON public.votes FROM anon, authenticated;
REVOKE SELECT ON public.elections FROM anon;
REVOKE ALL ON public.election_participants FROM anon, authenticated;
REVOKE ALL ON public.delegations FROM anon, authenticated;
REVOKE ALL ON public.nullifications FROM anon, authenticated;
REVOKE ALL ON public.nullification_accumulators FROM anon, authenticated;
REVOKE ALL ON public.election_authorities FROM anon;
REVOKE ALL ON public.election_authority_audit_log FROM anon;
REVOKE ALL ON public.election_tallies FROM anon;
GRANT SELECT ON public.public_votes TO anon, authenticated;
GRANT SELECT ON public.public_elections TO anon, authenticated;
GRANT SELECT ON public.public_participants TO anon, authenticated;
GRANT SELECT ON public.public_delegations TO anon, authenticated;
GRANT SELECT ON public.public_nullifications TO anon, authenticated;
GRANT SELECT ON public.public_nullification_accumulators TO anon, authenticated;
GRANT SELECT ON public.public_election_authorities TO anon, authenticated;
GRANT SELECT ON public.public_authority_audit_events TO anon, authenticated;
GRANT SELECT ON public.public_tallies TO anon, authenticated;

COMMENT ON VIEW public.public_votes IS
  'Public pseudonymous ballot ledger. Voter pseudonyms and choices are intentionally public and may be linkable.';
COMMENT ON VIEW public.public_elections IS
  'Public election metadata with the creator represented only by a pseudonymous World ID-derived identifier.';
COMMENT ON VIEW public.public_participants IS
  'Public pseudonymous participant registry and voting verification keys.';
COMMENT ON VIEW public.public_delegations IS
  'Public delegation existence and ciphertexts. The selected delegate is not exposed.';
COMMENT ON VIEW public.public_nullifications IS
  'Public nullification ciphertexts and proofs. A submission does not reveal whether it is real or a decoy.';
COMMENT ON VIEW public.public_nullification_accumulators IS
  'Public encrypted nullification accumulators used to audit tally inputs.';
