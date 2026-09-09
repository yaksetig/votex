-- Remediation for the 2026-08-20 source security audit.
--
-- 1. Remove direct authority mutation/audit paths.
-- 2. Add server-authored transactional election updates and auth events.
-- 3. Require complete tally result sets.
-- 4. Add deterministic public election activity ordering.
-- 5. Add canonical encoding checks for delegation ciphertext storage.

DROP POLICY IF EXISTS "Election authorities can update elections" ON public.elections;
DROP POLICY IF EXISTS "Election authorities can delete elections" ON public.elections;
DROP POLICY IF EXISTS "Authenticated authorities can insert audit logs"
  ON public.election_authority_audit_log;

REVOKE UPDATE, DELETE ON public.elections FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.election_authority_audit_log
  FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_election_details_atomic(
  p_election_id uuid,
  p_updates jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.elections%ROWTYPE;
  actor_name text;
  next_title text;
  next_description text;
  next_option1 text;
  next_option2 text;
  next_end_date timestamptz;
BEGIN
  IF p_election_id IS NULL OR p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ELECTION_UPDATE';
  END IF;

  IF p_updates = '{}'::jsonb OR EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_updates) AS update_key(key)
    WHERE key NOT IN ('title', 'description', 'option1', 'option2', 'end_date')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ELECTION_UPDATE_FIELDS';
  END IF;

  SELECT * INTO target
  FROM public.elections
  WHERE id = p_election_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ELECTION_NOT_FOUND';
  END IF;

  IF target.authority_id IS DISTINCT FROM public.get_authority_id_for_current_user() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUTHORITY_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.votes WHERE election_id = p_election_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ELECTION_ALREADY_STARTED';
  END IF;

  next_title := CASE WHEN p_updates ? 'title' THEN trim(p_updates ->> 'title') ELSE target.title END;
  next_description := CASE WHEN p_updates ? 'description' THEN trim(p_updates ->> 'description') ELSE target.description END;
  next_option1 := CASE WHEN p_updates ? 'option1' THEN trim(p_updates ->> 'option1') ELSE target.option1 END;
  next_option2 := CASE WHEN p_updates ? 'option2' THEN trim(p_updates ->> 'option2') ELSE target.option2 END;
  next_end_date := CASE
    WHEN p_updates ? 'end_date' THEN (p_updates ->> 'end_date')::timestamptz
    ELSE target.end_date
  END;

  IF length(next_title) < 3 OR length(next_title) > 100
     OR length(next_description) < 10 OR length(next_description) > 500
     OR length(next_option1) < 1 OR length(next_option1) > 50
     OR length(next_option2) < 1 OR length(next_option2) > 50
     OR lower(next_option1) = lower(next_option2)
     OR next_end_date <= now()
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ELECTION_UPDATE';
  END IF;

  SELECT name INTO actor_name
  FROM public.election_authorities
  WHERE id = target.authority_id
    AND auth_user_id = auth.uid();

  IF actor_name IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUTHORITY_REQUIRED';
  END IF;

  UPDATE public.elections
  SET title = next_title,
      description = next_description,
      option1 = next_option1,
      option2 = next_option2,
      end_date = next_end_date,
      last_modified_by = actor_name
  WHERE id = p_election_id;

  INSERT INTO public.election_authority_audit_log (
    election_id,
    action,
    performed_by,
    auth_user_id,
    details
  ) VALUES (
    p_election_id,
    'UPDATE_ELECTION',
    actor_name,
    auth.uid(),
    jsonb_build_object(
      'updated_fields', (
        SELECT jsonb_agg(key ORDER BY key)
        FROM jsonb_object_keys(p_updates) AS update_key(key)
      ),
      'updated_at', now()
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_election_details_atomic(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_election_details_atomic(uuid, jsonb)
  TO authenticated;

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
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_AUDIT_DETAILS';
  END IF;

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
    p_details
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_authority_authentication(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_authority_authentication(jsonb)
  TO authenticated;

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

  -- Supplied voters must equal the complete set represented by accepted ballots
  -- and active delegations. Subset-only validation allowed empty/partial official runs.
  IF EXISTS (
    WITH expected_voters AS (
      SELECT voter_id AS user_id FROM public.yes_votes WHERE election_id = p_election_id
      UNION
      SELECT voter_id FROM public.no_votes WHERE election_id = p_election_id
      UNION
      SELECT delegator_id FROM public.delegations
      WHERE election_id = p_election_id AND status = 'active'
    )
    SELECT user_id FROM expected_voters
    EXCEPT
    SELECT user_id FROM tally_input
  ) OR EXISTS (
    WITH expected_voters AS (
      SELECT voter_id AS user_id FROM public.yes_votes WHERE election_id = p_election_id
      UNION
      SELECT voter_id FROM public.no_votes WHERE election_id = p_election_id
      UNION
      SELECT delegator_id FROM public.delegations
      WHERE election_id = p_election_id AND status = 'active'
    )
    SELECT user_id FROM tally_input
    EXCEPT
    SELECT user_id FROM expected_voters
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INCOMPLETE_TALLY_RESULTS';
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

CREATE OR REPLACE FUNCTION public.is_canonical_babyjub_coordinate(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT value ~ '^(0|[1-9][0-9]*)$'
    AND length(value) <= 77
    AND (
      length(value) < 77
      OR value <= '21888242871839275222246405745257275088548364400416034343698204186575808495616'
    )
$$;

ALTER TABLE public.delegations
  DROP CONSTRAINT IF EXISTS delegations_canonical_ciphertext_coordinates;
ALTER TABLE public.delegations
  ADD CONSTRAINT delegations_canonical_ciphertext_coordinates CHECK (
    public.is_canonical_babyjub_coordinate(delegate_ct_c1_x)
    AND public.is_canonical_babyjub_coordinate(delegate_ct_c1_y)
    AND public.is_canonical_babyjub_coordinate(delegate_ct_c2_x)
    AND public.is_canonical_babyjub_coordinate(delegate_ct_c2_y)
    AND (delegate_ct_c1_x, delegate_ct_c1_y) <> ('0', '1')
    AND (delegate_ct_c2_x, delegate_ct_c2_y) <> ('0', '1')
  ) NOT VALID;

CREATE OR REPLACE VIEW public.public_election_activity AS
SELECT
  'delegation-' || delegation.id::text AS id,
  delegation.election_id,
  COALESCE(delegation.revoked_at, delegation.created_at) AS occurred_at,
  delegation.delegator_id AS pseudonym,
  CASE WHEN delegation.status = 'revoked'
    THEN 'Delegation revoked'
    ELSE 'Delegation submitted'
  END AS action,
  delegation.id::text AS record
FROM public.delegations AS delegation
UNION ALL
SELECT
  'nullification-' || nullification.id::text,
  nullification.election_id,
  nullification.created_at,
  nullification.user_id,
  'Nullification proof accepted',
  nullification.id::text
FROM public.nullifications AS nullification
UNION ALL
SELECT
  'tally-' || tally.id::text,
  tally.election_id,
  tally.processed_at,
  tally.user_id,
  'Tally record published',
  tally.tally_run_id::text
FROM public.election_tallies AS tally
UNION ALL
SELECT
  'authority-' || event.id::text,
  event.election_id,
  event.performed_at,
  event.performed_by,
  event.action,
  event.id::text
FROM public.election_authority_audit_log AS event
WHERE event.election_id IS NOT NULL;

GRANT SELECT ON public.public_election_activity TO anon, authenticated;
COMMENT ON VIEW public.public_election_activity IS
  'Deterministically pageable public election activity, including server-authored authority events.';
