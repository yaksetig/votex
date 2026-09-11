# Contributing to Votex

This page explains how the repository is laid out, which checks protect which
property, and the sequences that are easy to get wrong (migrations, circuit
rebuilds, releases). Protocol design lives in [CRYPTOGRAPHY.md](CRYPTOGRAPHY.md);
application boundaries in
[docs/PREPRODUCTION_ARCHITECTURE.md](docs/PREPRODUCTION_ARCHITECTURE.md).

## Layout

| Path | What lives there |
|---|---|
| `src/` | React frontend. `services/` holds crypto and data access, `pages/` and `components/` the UI, `lib/` dependency-free helpers. |
| `supabase/functions/` | Deno edge functions. Every trust decision (World ID verification, signatures, proofs, RLS-bypassing writes) happens here. `_shared/` is imported by several functions. |
| `supabase/functions/_shared/protocol.ts` | Dependency-free definitions shared **by both runtimes**: curve arithmetic, canonical encodings, signed-message formats, proof freshness. The frontend imports it as `@protocol`. Change a format here and both sides change together. |
| `supabase/migrations/` | Ordered SQL. Later files override earlier ones; the effective schema is the result of replaying all of them. |
| `circuits/` | Circom source, build script, static-analysis notes. Compiled artifacts ship from `public/circuits/`. |
| `e2e/` | Playwright lifecycle tests plus the stubs they run against. |
| `scripts/` | Authority bootstrap and release-integrity tooling. |

## Test suites and what each one proves

| Command | Runtime | Covers |
|---|---|---|
| `npm test` | Vitest, Node | Curve arithmetic and ElGamal, XOR accumulator algebra, **real Groth16 proving and verification against the shipped wasm/zkey** (`circuitNegative`), the shared protocol vectors, key derivation, delegation decoding, session-storage boundaries, cross-tab logout, the nullification retry flow, and the artifact-hash pins. |
| `cd supabase/functions && deno test --frozen --allow-env .` | Deno | The edge-function handlers with an in-memory Supabase fake: registration binding and proof of possession, session issuance with hashed verifiers, ballot acceptance, nullification batch validation and accumulator continuity, delegation authorisation, EdDSA verifier edge cases, point validation. `--frozen` also fails if any remote dependency drifts from `deno.lock`. |
| `npm run test:e2e` | Playwright | The full voter and authority journey in a real browser against deterministic stubs for World ID, WebAuthn, Supabase and the prover. It proves the UI wiring, not the cryptography. |
| `npm run analyze:circuits` | circomspect / circom | Static analysis of the circuit. |
| `npm run release:check` | Node | Edge-function manifest vs `supabase/config.toml`, migration naming, and SHA-256 pins of the circuit source, wasm, zkey and verification key (all three key copies must be identical). |

Run `npx tsc -b`, `npm run lint`, and the three test suites before pushing;
CI runs the same commands.

## Working on edge functions

- Put request handling in a `handler.ts` with injected dependencies
  (`register-keypair`, `worldid-session`, `vote-tracking-write` and
  `nullification-write` show the pattern) and keep `index.ts` to CORS, JSON
  parsing and `Deno.serve`. Handlers are testable with `fakeSupabase` from
  `_shared/testing.ts`.
- Every error leaves through `errorResponse(status, code, message)`; add new
  codes to the `ApiErrorCode` union in `_shared/http.ts` **and**
  `src/types/api.ts`.
- Run Deno commands from `supabase/functions/` so `deno.json` and `deno.lock`
  apply. After adding or bumping a dependency, run
  `deno test --frozen=false --allow-env .` once to update the lock, then rerun
  with `--frozen`.

## Database changes

1. Add a new file `supabase/migrations/<14-digit timestamp>_<name>.sql`. Never
   edit an applied migration.
2. New tables and functions are deny-by-default for `anon` and `authenticated`
   (default privileges were revoked in `20260909000000`); grant exactly what the
   browser needs, usually `SELECT` on a `public_*` view.
3. Replay everything on a throwaway PostgreSQL before pushing. With a local
   PostgreSQL 17 installed you can create a cluster with `initdb`, create the
   roles `anon`, `authenticated`, `service_role` and `postgres`, a stub
   `auth.uid()` function and `storage` schema, then `psql -f` each migration in
   order. Assert the privilege state with
   `SELECT * FROM information_schema.role_table_grants WHERE grantee IN ('anon','authenticated') AND privilege_type <> 'SELECT'`
   (expect no rows). `supabase db push --linked --dry-run` shows what a
   deployment would apply.
4. Regenerate `src/integrations/supabase/types.ts` if a view or table changed.

## Rebuilding the circuit

Any change to `circuits/nullification_xor.circom` needs new artifacts:

```sh
cd circuits && ./compile.sh
```

The script verifies the Powers of Tau file against the published Hermez
BLAKE2b digest, runs a single-contributor phase-2 contribution (development
only, see [docs/TRUSTED_SETUP_RUNBOOK.md](docs/TRUSTED_SETUP_RUNBOOK.md)),
copies `nullification_xor.wasm`, `nullification_xor_final.zkey` and
`verification_key_xor.json` to `public/circuits/`, and regenerates
`supabase/functions/_shared/verificationKeyXor.ts`. Then, in the same commit:

1. Update the four `circuitArtifacts` hashes in `release.config.json`
   (`shasum -a 256 <file>`).
2. Update the public-signal layout wherever it is described if it changed
   (`public/circuits/README.md`, `CRYPTOGRAPHY.md` §9,
   `_shared/nullification.ts`, `parallelZkProofService.ts`, the e2e stub).
3. Run `npm test` (the circuit tests prove and verify against the new files)
   and `npm run analyze:circuits`.

## Releasing

`docs/RELEASE_RUNBOOK.md` describes the production workflow. It runs only for
pushes to `main` in this repository after CI passes, requires
`PRODUCTION_RELEASE_ENABLED` and a `production` environment, and verifies the
live deployment afterwards. Production remains blocked until a multiparty
trusted setup is recorded in `release.config.json`.

## Style

- TypeScript strict mode; no `any` outside the untyped Supabase client shims.
- Comments explain *why*; the code says what. Reference the relevant
  `CRYPTOGRAPHY.md` section for protocol decisions.
- Prefer one implementation: anything needed by both the browser and the edge
  functions belongs in `_shared/protocol.ts`, not in two copies.
