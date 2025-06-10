
-- Create table to store election tally results
CREATE TABLE public.election_tallies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  nullification_count INTEGER NOT NULL DEFAULT 0,
  vote_nullified BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_by TEXT, -- The authority who processed this tally
  UNIQUE(election_id, user_id)
);

-- Add foreign key relationship to elections table
ALTER TABLE public.election_tallies 
ADD CONSTRAINT fk_election_tallies_election_id 
FOREIGN KEY (election_id) REFERENCES public.elections(id) ON DELETE CASCADE;

-- Enable RLS for election tallies
ALTER TABLE public.election_tallies ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read election tallies (public results)
CREATE POLICY "Anyone can view election tallies" 
  ON public.election_tallies 
  FOR SELECT 
  USING (true);

-- Create policy to allow insertion of new tallies (for processing)
CREATE POLICY "Anyone can insert election tallies" 
  ON public.election_tallies 
  FOR INSERT 
  WITH CHECK (true);

-- Create policy to allow updates to tallies (for reprocessing)
CREATE POLICY "Anyone can update election tallies" 
  ON public.election_tallies 
  FOR UPDATE 
  USING (true);
