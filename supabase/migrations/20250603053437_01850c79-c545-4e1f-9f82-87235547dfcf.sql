
-- Create a table for nullifications
CREATE TABLE public.nullifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  nullifier_ciphertext JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (election_id) REFERENCES public.elections(id) ON DELETE CASCADE
);

-- Add an index for faster queries by election and user
CREATE INDEX idx_nullifications_election_user ON public.nullifications(election_id, user_id);

-- Add an index for faster queries by election
CREATE INDEX idx_nullifications_election ON public.nullifications(election_id);
;
