-- VTX-005: Only the linked election authority auth user may mutate its elections.
-- The previous helper only checked that an election had some authority row.
-- This version resolves the caller through auth.uid() -> election_authorities.auth_user_id.

DROP POLICY IF EXISTS "Election authorities can update elections" ON public.elections;
DROP POLICY IF EXISTS "Election authorities can delete elections" ON public.elections;

DROP FUNCTION IF EXISTS public.is_election_authority_for_election(uuid);

CREATE OR REPLACE FUNCTION public.is_current_user_election_authority(authority_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT authority_id_param IS NOT NULL
    AND authority_id_param = public.get_authority_id_for_current_user();
$$;

CREATE POLICY "Election authorities can update elections"
  ON public.elections
  FOR UPDATE
  USING (public.is_current_user_election_authority(authority_id))
  WITH CHECK (public.is_current_user_election_authority(authority_id));

CREATE POLICY "Election authorities can delete elections"
  ON public.elections
  FOR DELETE
  USING (public.is_current_user_election_authority(authority_id));
