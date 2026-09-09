-- 2026-09-09 review, finding M-1: register-keypair now requires a proof of
-- possession for the submitted public key, so two World IDs can only end up
-- bound to the same key if the same passkey is used twice. Make that an
-- explicit database invariant instead of a race on election_participants.
--
-- Before applying on an installation with historical data, confirm there are
-- no duplicates:
--   SELECT public_key_x, public_key_y, count(*) FROM public.world_id_keypairs
--   GROUP BY 1, 2 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_world_id_keypairs_public_key
  ON public.world_id_keypairs (public_key_x, public_key_y);

-- 2026-09-09 review, finding F-7 / L-6: the session verifier is a static
-- bearer credential (SHA-256 of the passkey PRF secret and a domain tag) and
-- was stored exactly as the client presents it, so any read of this table
-- could mint sessions for every voter. register-keypair and worldid-session
-- now store and compare SHA-256(verifier); hash the legacy rows once here.
-- Postgres sha256(bytea) over UTF-8 matches the edge function's sha256Hex.
--
-- Deploy the updated edge functions immediately after this migration; sign-in
-- fails in the window between the two.
UPDATE public.world_id_auth_verifiers
SET verifier_hash = encode(sha256(convert_to(verifier_hash, 'UTF8')), 'hex'),
    updated_at = now();
