-- VTX-004 follow-up: authority rows must not be writable from the browser.
-- Public read access remains for election metadata, but all create/link/update
-- paths now go through authenticated server logic.

-- Ensure the default authority exists in the database.
INSERT INTO public.election_authorities (
  name,
  description,
  public_key_x,
  public_key_y
)
SELECT
  'Default Election Authority',
  'Primary election authority for the platform',
  '5299619240641551281634865583518297030282874472190772894086521144482721001553',
  '16950150798460657717958625567821834550301663161624707787222815936182638968203'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.election_authorities
  WHERE name = 'Default Election Authority'
);

ALTER TABLE public.election_authorities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view election authorities" ON public.election_authorities;
DROP POLICY IF EXISTS "No direct client inserts into election authorities" ON public.election_authorities;
DROP POLICY IF EXISTS "No direct client updates to election authorities" ON public.election_authorities;
DROP POLICY IF EXISTS "No direct client deletes from election authorities" ON public.election_authorities;

CREATE POLICY "Anyone can view election authorities"
  ON public.election_authorities
  FOR SELECT
  USING (true);

CREATE POLICY "No direct client inserts into election authorities"
  ON public.election_authorities
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct client updates to election authorities"
  ON public.election_authorities
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client deletes from election authorities"
  ON public.election_authorities
  FOR DELETE
  USING (false);
