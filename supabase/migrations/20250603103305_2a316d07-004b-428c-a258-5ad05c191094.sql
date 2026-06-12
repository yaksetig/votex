
-- Create table for storing trusted setup parameters per election
CREATE TABLE public.election_trusted_setups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  proving_key JSONB NOT NULL,
  verification_key JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  UNIQUE(election_id)
);

-- Add Row Level Security
ALTER TABLE public.election_trusted_setups ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the verification keys (needed for proof verification)
CREATE POLICY "Anyone can read verification keys" 
  ON public.election_trusted_setups 
  FOR SELECT 
  USING (true);

-- Only allow specific admins to insert setup data (we'll implement admin roles later)
CREATE POLICY "Only admins can create trusted setups" 
  ON public.election_trusted_setups 
  FOR INSERT 
  WITH CHECK (false); -- For now, block all inserts until we implement proper admin roles

-- Add index for faster lookups
CREATE INDEX idx_election_trusted_setups_election_id ON public.election_trusted_setups(election_id);
;
