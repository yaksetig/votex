
-- Add proving_key_url column to global_trusted_setups table and make hash/filename optional
ALTER TABLE global_trusted_setups 
ADD COLUMN proving_key_url TEXT;

-- Make proving_key_hash and proving_key_filename nullable since Firebase setup won't need them
ALTER TABLE global_trusted_setups 
ALTER COLUMN proving_key_hash DROP NOT NULL,
ALTER COLUMN proving_key_filename DROP NOT NULL;

-- Also add proving_key_url to election_trusted_setups for backward compatibility
ALTER TABLE election_trusted_setups 
ADD COLUMN proving_key_url TEXT;
;
