-- public_nullifications exposed nullifications.user_id as "submitter_pseudonym",
-- but the write path stores the TARGET slot of each proof in that column
-- (submit_nullification_batch inserts v_target_user_id). The submitter of a
-- batch is deliberately never persisted; that is what makes the k-anonymity
-- work. The old name asserted the opposite and invited a privacy regression.
--
-- A view column cannot be renamed with CREATE OR REPLACE, so the view is
-- recreated with the same privileges as 20260909000000 established.

DROP VIEW IF EXISTS public.public_nullifications;

CREATE VIEW public.public_nullifications AS
SELECT
  id,
  election_id,
  user_id AS target_pseudonym,
  nullifier_ciphertext,
  nullifier_zkp,
  created_at
FROM public.nullifications;

COMMENT ON VIEW public.public_nullifications IS
  'Public nullification ledger. target_pseudonym is the slot a proof touched, never who submitted it; a row does not reveal whether it was real or a decoy.';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.public_nullifications FROM anon, authenticated;
GRANT SELECT ON public.public_nullifications TO anon, authenticated;
