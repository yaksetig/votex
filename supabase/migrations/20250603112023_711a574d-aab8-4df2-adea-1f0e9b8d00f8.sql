
-- Update the election_trusted_setups table to support hybrid storage
-- Add columns for proving key metadata and remove the large proving_key JSONB
ALTER TABLE election_trusted_setups 
ADD COLUMN proving_key_hash TEXT,
ADD COLUMN proving_key_filename TEXT;

-- The proving_key column will remain for backward compatibility but won't be used for new setups
-- In production, you might want to drop it after migration:
-- ALTER TABLE election_trusted_setups DROP COLUMN proving_key;
;
