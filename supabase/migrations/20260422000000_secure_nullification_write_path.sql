-- VTX-014: move nullification writes behind a trusted server-side path.
--
-- Rationale:
--   Alice must be allowed to submit a dummy batch that touches other
--   participants' accumulator slots, so client-side RLS tied to the
--   target voter id is the wrong model.
--
--   The correct model is:
--     1. authorize the submitter separately
--     2. keep target slots unrestricted inside the batch
--     3. block direct client writes to nullifications / accumulators
--     4. apply the batch transactionally through a trusted function

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('nullifications', 'nullification_accumulators')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_record.policyname,
      policy_record.tablename
    );
  END LOOP;
END
$$;

ALTER TABLE public.nullifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nullification_accumulators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view nullifications"
  ON public.nullifications
  FOR SELECT
  USING (true);

CREATE POLICY "No direct client inserts into nullifications"
  ON public.nullifications
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to nullifications"
  ON public.nullifications
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client deletes from nullifications"
  ON public.nullifications
  FOR DELETE
  USING (false);

CREATE POLICY "Accumulators are publicly readable"
  ON public.nullification_accumulators
  FOR SELECT
  USING (true);

CREATE POLICY "No direct client inserts into nullification_accumulators"
  ON public.nullification_accumulators
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to nullification_accumulators"
  ON public.nullification_accumulators
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client deletes from nullification_accumulators"
  ON public.nullification_accumulators
  FOR DELETE
  USING (false);

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.election_participants
    WHERE election_id = p_election_id
      AND participant_id = p_submitter_id
  ) THEN
    RAISE EXCEPTION 'Submitter is not a participant in this election';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS batch_item(value)
    WHERE batch_item.value ->> 'userId' = p_submitter_id
  ) THEN
    RAISE EXCEPTION 'Nullification batch must include the submitter slot';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
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
