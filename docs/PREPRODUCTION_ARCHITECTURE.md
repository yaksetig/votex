# Pre-production architecture

This document describes application boundaries. It does not replace the
protocol details in `CRYPTOGRAPHY.md`.

## Identity and session

1. The browser creates or unlocks a PRF-capable passkey.
2. The passkey secret deterministically derives the existing BabyJubJub key.
3. The public key hash is included as the World ID signal.
4. `register-keypair` verifies the World ID proof and signal binding.
5. `worldid-session` verifies continuity with the passkey-derived verifier and
   issues a random bearer token whose hash is stored server-side.

## Fixed Election Authority bootstrap

1. Generate the authority secret outside source control. Keep it in a password
   manager; never pass it as a command-line argument.
2. Generate a UUID and configure it as the production edge-function
   `FIXED_AUTHORITY_ID`.
3. Run
   `npm run bootstrap:authority -- --authority-id <configured-uuid>`. The
   interactive command reads the secret with hidden terminal input, derives the
   existing Votex public key locally, and creates only the fixed authority row.
   The private secret is never printed, stored, or sent to Supabase.
4. Create the authority’s Supabase Auth account through the bootstrap UI.
5. Enter the same authority name and secret. `authority-link` verifies the
   existing ownership-proof message and links only the configured row.
6. Confirm `fixed-authority-status` reports `configured=true` and `linked=true`.

The secret is entered only for local derivation and proof/tally operations. It
must never be added to SQL, environment variables, logs, or the database.

## Election creation

`create-election` validates the custom World ID session, derives the creator
pseudonym from it, resolves the configured fixed authority, validates the
binary election fields, and calls `create_election_atomic`. Direct browser
inserts are denied. Idempotency is scoped to creator plus request UUID.

## Ballot casting

The existing `${electionId}:${choice}:${timestamp}` message and EdDSA signature
format are unchanged. `vote-tracking-write` validates the session, participant
key, election, timestamp, choice, and signature before calling
`cast_vote_atomic`. The canonical ballot, yes/no tracking row, and receipt share
one transaction. The public `public_votes` view exposes the pseudonym, choice,
signature, times, and receipt UUID.

## Delegation and nullification

Delegation ciphertext formats and decryption are unchanged. Creation,
replacement, and revocation use one atomic database function, with the
delegator derived from the World ID session. Nullification continues through
the existing server-verified proof path and transactional accumulator RPC.

## Closure and tally

The linked fixed authority closes an election through `close_election_atomic`,
which is idempotent and writes one audit event. Once the first vote exists,
ballot metadata and timing are immutable. The existing client tally computation
is unchanged; persistence uses one atomic tally run and requires an explicit
replacement action to overwrite a previous run.
