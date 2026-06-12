-- H2: global_trusted_setups was created without RLS (world-writable trust
-- store) and election_trusted_setups is referenced nowhere in the app. Both
-- tables were already dropped out-of-band in the live database (verified
-- 2026-06-11: PostgREST reports neither table exists); this migration codifies
-- that drop so the in-repo schema history matches reality. The authoritative
-- verification key is hard-coded in the nullification-write edge function
-- (_shared/verificationKeyXor.ts), not read from the database.

DROP TABLE IF EXISTS public.global_trusted_setups;
DROP TABLE IF EXISTS public.election_trusted_setups;
