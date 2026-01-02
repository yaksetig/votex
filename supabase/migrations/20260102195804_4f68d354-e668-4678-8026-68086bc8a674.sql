-- Allow updates via service role (for passkey recovery)
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "No updates allowed" ON public.world_id_keypairs;

-- Create a new policy that allows updates (service role bypasses RLS anyway,
-- but this documents the intent and allows for future flexibility)
CREATE POLICY "Updates allowed via service role"
  ON public.world_id_keypairs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);