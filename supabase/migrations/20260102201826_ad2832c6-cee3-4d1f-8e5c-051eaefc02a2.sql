-- Clear all voting and election-related data
-- Order matters due to implicit relationships

-- 1. Clear vote tracking tables
DELETE FROM public.yes_votes;
DELETE FROM public.no_votes;
DELETE FROM public.votes;

-- 2. Clear election participant data
DELETE FROM public.election_participants;
DELETE FROM public.election_tallies;
DELETE FROM public.nullifications;

-- 3. Clear audit logs
DELETE FROM public.election_authority_audit_log;

-- 4. Clear elections (after dependent data is gone)
DELETE FROM public.elections;

-- 5. Clear election authorities
DELETE FROM public.election_authorities;

-- 6. Clear keypair tables
DELETE FROM public.keypairs;
DELETE FROM public.world_id_keypairs;