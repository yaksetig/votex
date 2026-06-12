-- Remote baseline: codifies the dashboard-era objects that predate the
-- migration chain. elections, votes, keypairs, and insert_vote() were created
-- through the Supabase dashboard (Lovable) and existed in the live database
-- only; every later migration assumes them. Definitions captured from a live
-- `supabase db dump` on 2026-06-11, with columns/constraints/policies added by
-- later in-repo migrations stripped (authority_id, status, last_modified_*,
-- authority policies, replica identity).
--
-- This file is marked as applied in the remote migration history; it runs for
-- real only on shadow/local databases.

CREATE TABLE IF NOT EXISTS public.elections (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  creator text NOT NULL,
  end_date timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  option1 text DEFAULT 'Yes'::text NOT NULL,
  option2 text DEFAULT 'No'::text NOT NULL
);

ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read elections"
  ON public.elections FOR SELECT USING (true);

-- Open INSERT as it existed live; locked down in 20260611100400.
CREATE POLICY "Authenticated users can create elections"
  ON public.elections FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.votes (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  voter text NOT NULL,
  choice text NOT NULL,
  signature text NOT NULL,
  "timestamp" bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  nullifier text,
  CONSTRAINT votes_election_id_voter_key UNIQUE (election_id, voter)
);

CREATE UNIQUE INDEX idx_votes_nullifier ON public.votes USING btree (nullifier);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read votes"
  ON public.votes FOR SELECT USING (true);

-- Open INSERT as it existed live; locked down in 20260611100400.
CREATE POLICY "Authenticated users can vote once per election"
  ON public.votes FOR INSERT WITH CHECK (true);

-- Legacy pre-World-ID keypair table; dropped in 20260611100400.
CREATE TABLE IF NOT EXISTS public.keypairs (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  public_key_x text NOT NULL,
  public_key_y text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unique_public_key UNIQUE (public_key_x, public_key_y)
);

ALTER TABLE public.keypairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert keypairs"
  ON public.keypairs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can view keypairs"
  ON public.keypairs FOR SELECT TO anon USING (true);

-- Unvalidated vote insert RPC as it existed live; dropped in 20260611100400
-- in favor of the signature-verifying cast-vote edge function path.
CREATE OR REPLACE FUNCTION public.insert_vote(
  p_election_id uuid,
  p_voter text,
  p_choice text,
  p_nullifier text,
  p_signature text,
  p_timestamp bigint
) RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.votes (
    election_id,
    voter,
    choice,
    nullifier,
    signature,
    timestamp
  ) VALUES (
    p_election_id,
    p_voter,
    p_choice,
    p_nullifier,
    p_signature,
    p_timestamp
  );

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error inserting vote: %', SQLERRM;
  RETURN FALSE;
END;
$$;
