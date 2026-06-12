
-- Add nullifier_zkp column to nullifications table
ALTER TABLE public.nullifications 
ADD COLUMN nullifier_zkp JSONB;
;
