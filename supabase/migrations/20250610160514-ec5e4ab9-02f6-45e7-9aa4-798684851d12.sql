
-- Add INSERT policy to allow the application to populate the discrete log lookup table
-- Use WITH CHECK instead of USING for INSERT policy
CREATE POLICY "Anyone can insert discrete log lookup" 
  ON public.discrete_log_lookup 
  FOR INSERT 
  WITH CHECK (true);
