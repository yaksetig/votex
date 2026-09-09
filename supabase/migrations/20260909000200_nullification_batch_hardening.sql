-- 2026-09-09 review, findings F2/F8 on the nullification path.
--
-- 1. k-anonymity ordering. The RPC inserted batch rows in client array order
--    and stamped every row of a batch with the same created_at. The browser
--    always put the submitter's own slot first, so heap order revealed which
--    of the k slots belonged to the submitter. The loop now iterates in a
--    deterministic order that does not depend on the client (sorted by the
--    target id), which also gives a stable lock order and removes the
--    deadlock risk between overlapping concurrent batches. The client
--    shuffles as well.
-- 2. Griefing. Any participant can rerandomize any other participant's slot
--    (a decoy needs no secret), bumping its version and making an in-flight
--    real nullification fail with a version conflict. Batches are now rate
--    limited per submitter: one batch per election per 60 seconds, tracked
--    in election_participants.last_nullification_at (not exposed by the
--    public_participants projection).
-- 3. Defense in depth previously only in the edge function: the election must
--    be open and a batch may not exceed 16 items.

ALTER TABLE public.election_participants
  ADD COLUMN IF NOT EXISTS last_nullification_at timestamptz;

CREATE OR REPLACE FUNCTION public.submit_nullification_batch(
  p_election_id uuid,
  p_submitter_id text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_now timestamptz := now();
  v_processed_rows integer := 0;
  v_target_user_id text;
  v_expected_version integer;
  v_ciphertext jsonb;
  v_current_accumulator jsonb;
  v_new_accumulator jsonb;
  v_nullifier_zkp jsonb;
  v_existing_version integer;
  v_existing_acc_c1_x text;
  v_existing_acc_c1_y text;
  v_existing_acc_c2_x text;
  v_existing_acc_c2_y text;
  v_election_closed boolean;
  v_last_batch_at timestamptz;
  v_identity jsonb := jsonb_build_object(
    'c1', jsonb_build_object('x', '0', 'y', '1'),
    'c2', jsonb_build_object('x', '0', 'y', '1')
  );
BEGIN
  IF p_election_id IS NULL THEN
    RAISE EXCEPTION 'Missing election id';
  END IF;

  IF p_submitter_id IS NULL OR length(trim(p_submitter_id)) = 0 THEN
    RAISE EXCEPTION 'Missing submitter id';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Nullification batch must be a non-empty array';
  END IF;

  IF jsonb_array_length(p_items) > 16 THEN
    RAISE EXCEPTION 'Nullification batch exceeds the maximum of 16 items';
  END IF;

  SELECT closed_manually_at IS NOT NULL OR end_date <= v_now
  INTO v_election_closed
  FROM public.elections
  WHERE id = p_election_id
  FOR SHARE;

  IF v_election_closed IS NULL THEN
    RAISE EXCEPTION 'Election not found';
  END IF;

  IF v_election_closed THEN
    RAISE EXCEPTION 'ELECTION_CLOSED';
  END IF;

  -- Lock the submitter's participant row for the whole batch: this is both
  -- the participation check and the per-submitter rate limit.
  SELECT last_nullification_at
  INTO v_last_batch_at
  FROM public.election_participants
  WHERE election_id = p_election_id
    AND participant_id = p_submitter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submitter is not a participant in this election';
  END IF;

  IF v_last_batch_at IS NOT NULL AND v_last_batch_at > v_now - interval '60 seconds' THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS batch_item(value)
    WHERE batch_item.value ->> 'userId' = p_submitter_id
  ) THEN
    RAISE EXCEPTION 'Nullification batch must include the submitter slot';
  END IF;

  UPDATE public.election_participants
  SET last_nullification_at = v_now
  WHERE election_id = p_election_id
    AND participant_id = p_submitter_id;

  -- Deterministic, client-independent processing order.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS batch_item(value)
    ORDER BY batch_item.value ->> 'userId'
  LOOP
    v_target_user_id := v_item ->> 'userId';
    v_expected_version := (v_item ->> 'accumulatorVersion')::integer;
    v_ciphertext := v_item -> 'ciphertext';
    v_current_accumulator := v_item -> 'currentAccumulator';
    v_new_accumulator := v_item -> 'newAccumulator';
    v_nullifier_zkp := v_item -> 'nullifierZkp';

    IF v_target_user_id IS NULL
      OR v_ciphertext IS NULL
      OR v_current_accumulator IS NULL
      OR v_new_accumulator IS NULL
      OR v_nullifier_zkp IS NULL
      OR v_expected_version IS NULL
    THEN
      RAISE EXCEPTION 'Nullification batch contains an incomplete item';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.election_participants
      WHERE election_id = p_election_id
        AND participant_id = v_target_user_id
    ) THEN
      RAISE EXCEPTION 'Target user % is not a participant in this election', v_target_user_id;
    END IF;

    SELECT
      version,
      acc_c1_x,
      acc_c1_y,
      acc_c2_x,
      acc_c2_y
    INTO
      v_existing_version,
      v_existing_acc_c1_x,
      v_existing_acc_c1_y,
      v_existing_acc_c2_x,
      v_existing_acc_c2_y
    FROM public.nullification_accumulators
    WHERE election_id = p_election_id
      AND voter_id = v_target_user_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing_version <> v_expected_version THEN
        RAISE EXCEPTION 'Accumulator version mismatch for voter %', v_target_user_id;
      END IF;

      IF v_existing_acc_c1_x <> (v_current_accumulator #>> '{c1,x}')
        OR v_existing_acc_c1_y <> (v_current_accumulator #>> '{c1,y}')
        OR v_existing_acc_c2_x <> (v_current_accumulator #>> '{c2,x}')
        OR v_existing_acc_c2_y <> (v_current_accumulator #>> '{c2,y}')
      THEN
        RAISE EXCEPTION 'Accumulator state mismatch for voter %', v_target_user_id;
      END IF;

      UPDATE public.nullification_accumulators
      SET
        acc_c1_x = v_new_accumulator #>> '{c1,x}',
        acc_c1_y = v_new_accumulator #>> '{c1,y}',
        acc_c2_x = v_new_accumulator #>> '{c2,x}',
        acc_c2_y = v_new_accumulator #>> '{c2,y}',
        version = v_expected_version + 1,
        updated_at = v_now
      WHERE election_id = p_election_id
        AND voter_id = v_target_user_id;
    ELSE
      IF v_expected_version <> 0 OR v_current_accumulator <> v_identity THEN
        RAISE EXCEPTION 'Accumulator bootstrap mismatch for voter %', v_target_user_id;
      END IF;

      INSERT INTO public.nullification_accumulators (
        election_id,
        voter_id,
        acc_c1_x,
        acc_c1_y,
        acc_c2_x,
        acc_c2_y,
        version,
        created_at,
        updated_at
      ) VALUES (
        p_election_id,
        v_target_user_id,
        v_new_accumulator #>> '{c1,x}',
        v_new_accumulator #>> '{c1,y}',
        v_new_accumulator #>> '{c2,x}',
        v_new_accumulator #>> '{c2,y}',
        1,
        v_now,
        v_now
      );
    END IF;

    INSERT INTO public.nullifications (
      election_id,
      user_id,
      nullifier_ciphertext,
      nullifier_zkp,
      created_at
    ) VALUES (
      p_election_id,
      v_target_user_id,
      v_ciphertext,
      v_nullifier_zkp,
      v_now
    );

    v_processed_rows := v_processed_rows + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processedRows', v_processed_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_nullification_batch(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_nullification_batch(uuid, text, jsonb)
  TO service_role;
