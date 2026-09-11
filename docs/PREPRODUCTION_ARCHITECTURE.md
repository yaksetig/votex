# Pre-production architecture

This document describes application boundaries. It does not replace the
protocol details in `CRYPTOGRAPHY.md`.

## Identity and session

1. The browser creates or unlocks a PRF-capable passkey.
2. The passkey secret deterministically derives the existing BabyJubJub key.
3. The public key hash is included as the World ID signal.
4. `register-keypair` verifies the World ID proof (requiring `success` and
   exactly one successful result from the API), the signal binding, and an
   EdDSA proof of possession of the submitted key; the session verifier is
   stored hashed.
5. `worldid-session` verifies continuity with the passkey-derived verifier and
   issues a random bearer token whose hash is stored server-side.

## Fixed Election Authority bootstrap

1. Run `npm run generate:authority-secret` on a trusted offline workstation.
   Store the generated 256-bit `votex-auth-v1_…` recovery key in a password
   manager; never pass it as a command-line argument or invent a human password.
2. Generate a UUID and configure it as the production edge-function
   `FIXED_AUTHORITY_ID`.
3. Run
   `npm run bootstrap:authority -- --authority-id <configured-uuid>`. The
   interactive command reads the generated recovery key with hidden terminal input, derives the
   existing Votex public key locally, and creates only the fixed authority row.
   The private secret is never printed, stored, or sent to Supabase.
4. Create the authority’s Supabase Auth account through the bootstrap UI.
5. Enter the same authority name and secret. `authority-link` verifies the
   existing ownership-proof message and links only the configured row.
6. Confirm `fixed-authority-status` reports `configured=true` and `linked=true`.

The recovery key is entered only for local derivation and proof/tally operations. It
must never be added to SQL, environment variables, logs, or the database.

An installation that previously used a human-chosen authority secret must
rotate to this format only between elections. Updating the authority public key
while an election has encrypted accumulators or delegations would make that
state undecryptable with the new recovery key.

## Election creation

`create-election` validates the custom World ID session, derives the creator
pseudonym from it, resolves the configured fixed authority, validates the
binary election fields, and calls `create_election_atomic`. Direct browser
inserts are denied. Idempotency is scoped to creator plus request UUID.

## Ballot casting

Ballots are signed over `${electionId}:${choice}:${timestamp}` with the voting
key. `vote-tracking-write` validates the session, participant key, election,
timestamp, choice, signature and input sizes before calling
`cast_vote_atomic`. The canonical ballot, yes/no tracking row, and receipt share
one transaction. The public `public_votes` view exposes the pseudonym, choice,
signature, times, and receipt UUID.

## Delegation and nullification

Delegation creation, replacement and revocation use one atomic database
function. The delegator is derived from the World ID session and must also
sign the exact action with the voting key (`votex:delegation:v1:…`), so a
session alone cannot move a ballot. Ciphertext coordinates are validated as
canonical prime-subgroup points.

Nullification batches go through `nullification-write`, which verifies every
Groth16 proof, binds its public signals to the election id, the authority key,
the target's registered key and the stored accumulator version, recomputes the
new accumulator itself, and persists through a transactional RPC that
processes items in a client-independent order and rate-limits each submitter
to one batch per election per minute. The browser shuffles slot order and
retries on accumulator conflicts. All message formats and encodings shared by
both runtimes live in `supabase/functions/_shared/protocol.ts`.

## Closure and tally

The linked fixed authority closes an election through `close_election_atomic`,
which is idempotent and writes one audit event. Once the first vote exists,
ballot metadata and timing are immutable. The existing client tally computation
is unchanged; persistence uses one atomic tally run and requires an explicit
replacement action to overwrite a previous run.
