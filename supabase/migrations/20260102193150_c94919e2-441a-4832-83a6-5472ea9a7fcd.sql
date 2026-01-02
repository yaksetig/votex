-- Create table for World ID to BabyJubJub public key bindings
-- This stores the cryptographic binding between a World ID nullifier and a derived public key
CREATE TABLE public.world_id_keypairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nullifier_hash TEXT NOT NULL UNIQUE,
  public_key_x TEXT NOT NULL,
  public_key_y TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for faster lookups by nullifier_hash
CREATE INDEX idx_world_id_keypairs_nullifier ON public.world_id_keypairs(nullifier_hash);

-- Enable Row Level Security
ALTER TABLE public.world_id_keypairs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read public keys (they are public by design)
CREATE POLICY "Anyone can read public keys"
  ON public.world_id_keypairs 
  FOR SELECT
  USING (true);

-- Disallow direct inserts from client (must go through edge function with service role)
-- This ensures World ID proof is verified before storing the binding
CREATE POLICY "No direct client inserts"
  ON public.world_id_keypairs 
  FOR INSERT
  WITH CHECK (false);

-- Disallow updates (bindings are immutable)
CREATE POLICY "No updates allowed"
  ON public.world_id_keypairs 
  FOR UPDATE
  USING (false);

-- Disallow deletes (bindings are permanent)
CREATE POLICY "No deletes allowed"
  ON public.world_id_keypairs 
  FOR DELETE
  USING (false);