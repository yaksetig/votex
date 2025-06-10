
-- Create separate tables for Yes and No votes with nullification tracking
CREATE TABLE public.yes_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL,
  voter_id TEXT NOT NULL,
  nullified BOOLEAN NOT NULL DEFAULT false,
  nullification_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(election_id, voter_id)
);

CREATE TABLE public.no_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL,
  voter_id TEXT NOT NULL,
  nullified BOOLEAN NOT NULL DEFAULT false,
  nullification_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(election_id, voter_id)
);

-- Enable Row Level Security
ALTER TABLE public.yes_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.no_votes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for yes_votes
CREATE POLICY "Anyone can view yes_votes" 
  ON public.yes_votes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert yes_votes" 
  ON public.yes_votes 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update yes_votes" 
  ON public.yes_votes 
  FOR UPDATE 
  USING (true);

-- Create RLS policies for no_votes
CREATE POLICY "Anyone can view no_votes" 
  ON public.no_votes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert no_votes" 
  ON public.no_votes 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update no_votes" 
  ON public.no_votes 
  FOR UPDATE 
  USING (true);

-- Migrate existing votes to the new structure
INSERT INTO public.yes_votes (election_id, voter_id, created_at)
SELECT DISTINCT election_id, voter, created_at 
FROM public.votes 
WHERE choice = 'Yes'
ON CONFLICT (election_id, voter_id) DO NOTHING;

INSERT INTO public.no_votes (election_id, voter_id, created_at)
SELECT DISTINCT election_id, voter, created_at 
FROM public.votes 
WHERE choice = 'No'
ON CONFLICT (election_id, voter_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX idx_yes_votes_election_id ON public.yes_votes(election_id);
CREATE INDEX idx_no_votes_election_id ON public.no_votes(election_id);
CREATE INDEX idx_yes_votes_nullified ON public.yes_votes(election_id, nullified);
CREATE INDEX idx_no_votes_nullified ON public.no_votes(election_id, nullified);
