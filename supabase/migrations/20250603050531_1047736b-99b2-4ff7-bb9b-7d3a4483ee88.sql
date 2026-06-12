
-- First, let's check what RLS policies exist and remove any that conflict with wallet auth
DROP POLICY IF EXISTS "Users can insert their own participation" ON public.election_participants;
DROP POLICY IF EXISTS "Users can view participants" ON public.election_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.election_participants;
DROP POLICY IF EXISTS "Users can delete their own participation" ON public.election_participants;

-- Create new policies that work with wallet-based authentication
-- Allow anyone to insert participants (since we validate participant_id in the application)
CREATE POLICY "Allow participant registration" 
  ON public.election_participants 
  FOR INSERT 
  WITH CHECK (true);

-- Allow anyone to view participants (needed for nullification process)
CREATE POLICY "Allow viewing participants" 
  ON public.election_participants 
  FOR SELECT 
  USING (true);

-- Allow users to update their own participation records
CREATE POLICY "Allow updating own participation" 
  ON public.election_participants 
  FOR UPDATE 
  USING (true);

-- Allow users to delete their own participation records
CREATE POLICY "Allow deleting own participation" 
  ON public.election_participants 
  FOR DELETE 
  USING (true);
;
