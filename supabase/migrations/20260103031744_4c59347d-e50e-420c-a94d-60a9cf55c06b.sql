-- Update the Default Election Authority with the correct circomlib-compatible public key
-- These values correspond to sk=1 using the circomlib BabyJubJub generator
UPDATE election_authorities 
SET 
  public_key_x = '5299619240641551281634865583518297030282874472190772894086521144482721001553',
  public_key_y = '16950150798460657717958625567821834550301663161624707787222815936182638968203',
  updated_at = NOW()
WHERE name = 'Default Election Authority';