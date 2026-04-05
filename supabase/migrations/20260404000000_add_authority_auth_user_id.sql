-- VTX-004: Link election authorities to Supabase Auth users.
-- This column lets RLS policies use auth.uid() to verify the caller
-- is actually the authority that owns a given election.

ALTER TABLE public.election_authorities
  ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Unique constraint: one authority row per auth user
CREATE UNIQUE INDEX uq_election_authorities_auth_user_id
  ON public.election_authorities (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Helper: resolve the authority row for the currently authenticated user.
-- Returns NULL when there is no binding yet.
CREATE OR REPLACE FUNCTION public.get_authority_id_for_current_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id
  FROM public.election_authorities
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;
