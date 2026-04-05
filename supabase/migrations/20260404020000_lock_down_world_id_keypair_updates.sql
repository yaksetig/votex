-- Client writes to world_id_keypairs must stay blocked.
-- Registration and explicit recovery go through edge functions using the service role.
DROP POLICY IF EXISTS "Updates allowed via service role" ON public.world_id_keypairs;
DROP POLICY IF EXISTS "No updates allowed" ON public.world_id_keypairs;

CREATE POLICY "No direct client updates"
  ON public.world_id_keypairs
  FOR UPDATE
  USING (false)
  WITH CHECK (false);
