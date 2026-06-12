
-- Create global_trusted_setups table for universal trusted setups
CREATE TABLE public.global_trusted_setups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  verification_key JSONB NOT NULL,
  proving_key_hash TEXT NOT NULL,
  proving_key_filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false
);

-- Create unique constraint to ensure only one active setup at a time
CREATE UNIQUE INDEX idx_global_trusted_setups_active 
ON public.global_trusted_setups (is_active) 
WHERE is_active = true;

-- Add comments for clarity
COMMENT ON TABLE public.global_trusted_setups IS 'Global trusted setups shared across all elections';
COMMENT ON COLUMN public.global_trusted_setups.verification_key IS 'JSON verification key read from verification-key.key file';
COMMENT ON COLUMN public.global_trusted_setups.proving_key_hash IS 'SHA-256 hash of the proving-key.key file for integrity verification';
COMMENT ON COLUMN public.global_trusted_setups.proving_key_filename IS 'Filename of the proving key file on the server (e.g., proving-key.key)';
COMMENT ON COLUMN public.global_trusted_setups.is_active IS 'Only one setup can be active at a time';
;
