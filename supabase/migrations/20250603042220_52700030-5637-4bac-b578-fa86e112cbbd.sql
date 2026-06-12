
-- Create the election_participants table to track all public keys for each election
CREATE TABLE public.election_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  public_key_x TEXT NOT NULL,
  public_key_y TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure no duplicate public keys per election
  UNIQUE(election_id, public_key_x, public_key_y)
);

-- Add indexes for efficient querying
CREATE INDEX idx_election_participants_election_id ON public.election_participants(election_id);
CREATE INDEX idx_election_participants_participant_id ON public.election_participants(participant_id);

-- Enable Row Level Security
ALTER TABLE public.election_participants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view all participants for any election (needed for nullification process)
CREATE POLICY "Anyone can view election participants" 
  ON public.election_participants 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Users can only insert their own participation record
CREATE POLICY "Users can insert their own participation" 
  ON public.election_participants 
  FOR INSERT 
  TO authenticated
  WITH CHECK (participant_id = auth.uid()::text);

-- No updates or deletes allowed for data integrity
CREATE POLICY "No updates allowed" 
  ON public.election_participants 
  FOR UPDATE 
  TO authenticated
  USING (false);

CREATE POLICY "No deletes allowed" 
  ON public.election_participants 
  FOR DELETE 
  TO authenticated
  USING (false);
;
