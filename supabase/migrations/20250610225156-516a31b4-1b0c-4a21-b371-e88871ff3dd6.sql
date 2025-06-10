
-- Create a security definer function to check if the current user is an election authority for a specific election
CREATE OR REPLACE FUNCTION public.is_election_authority_for_election(election_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.elections e
    INNER JOIN public.election_authorities ea ON e.authority_id = ea.id
    WHERE e.id = election_id_param
  );
$$;

-- Add UPDATE policy for elections - only allow updates (no user-based restriction for now, but could be enhanced)
CREATE POLICY "Election authorities can update elections" 
  ON public.elections 
  FOR UPDATE 
  USING (public.is_election_authority_for_election(id))
  WITH CHECK (public.is_election_authority_for_election(id));

-- Add DELETE policy for elections - only allow election authorities to delete
CREATE POLICY "Election authorities can delete elections" 
  ON public.elections 
  FOR DELETE 
  USING (public.is_election_authority_for_election(id));

-- Ensure RLS is enabled on the elections table
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
