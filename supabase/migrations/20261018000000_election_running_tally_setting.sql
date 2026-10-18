-- Per-election choice of whether the running result is shown while voting
-- is open. Default true keeps every existing election's behaviour; creators
-- can opt out so the ballot page and the elections list hide counts until
-- the election closes. The column is public (it is a display rule, not a
-- secret), so it is added to the public_elections projection.

ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS show_running_tally boolean NOT NULL DEFAULT true;

-- create_election_atomic gains a trailing parameter. The previous signature is
-- dropped so PostgREST/RPC resolution is unambiguous; the service-role grant
-- is re-issued on the new signature.
DROP FUNCTION IF EXISTS public.create_election_atomic(text, uuid, text, text, text, text, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.create_election_atomic(
  p_creator text,
  p_authority_id uuid,
  p_title text,
  p_description text,
  p_option1 text,
  p_option2 text,
  p_end_date timestamptz,
  p_idempotency_key uuid,
  p_show_running_tally boolean DEFAULT true
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
    status,
    show_running_tally
  ) VALUES (
    p_title,
    p_description,
    p_option1,
    p_option2,
    p_creator,
    p_end_date,
    p_authority_id,
    'active',
    COALESCE(p_show_running_tally, true)
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

REVOKE ALL ON FUNCTION public.create_election_atomic(text, uuid, text, text, text, text, timestamptz, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_election_atomic(text, uuid, text, text, text, text, timestamptz, uuid, boolean)
  TO service_role;

-- update_election_details_atomic accepts the new key. Everything else is the
-- 20260820 body unchanged: the whitelist, the authority check, the
-- no-votes-yet rule, the audit row.
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
  next_show_running_tally boolean;
BEGIN
  IF p_election_id IS NULL OR p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ELECTION_UPDATE';
  END IF;

  IF p_updates = '{}'::jsonb OR EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_updates) AS update_key(key)
    WHERE key NOT IN ('title', 'description', 'option1', 'option2', 'end_date', 'show_running_tally')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ELECTION_UPDATE_FIELDS';
  END IF;

  IF p_updates ? 'show_running_tally' AND jsonb_typeof(p_updates -> 'show_running_tally') <> 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ELECTION_UPDATE';
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
  next_show_running_tally := CASE
    WHEN p_updates ? 'show_running_tally' THEN (p_updates ->> 'show_running_tally')::boolean
    ELSE target.show_running_tally
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
      show_running_tally = next_show_running_tally,
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

-- Expose the setting. CREATE OR REPLACE VIEW keeps existing grants and only
-- appends the new column at the end of the projection.
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
  closed_manually_at,
  show_running_tally
FROM public.elections;

GRANT SELECT ON public.public_elections TO anon, authenticated;
