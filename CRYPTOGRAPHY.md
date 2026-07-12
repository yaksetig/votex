# Cryptography Overview

This document describes the active cryptographic design in Votex as implemented in the current repository snapshot.

It covers:

- passkey-based key derivation
- World ID binding
- EdDSA signing and verification
- BabyJubJub ElGamal encryption and tallying
- Groth16 nullification proofs
- delegation privacy
- RP signature generation for World ID v4 request contexts

It does not attempt to describe generic UI/auth code unless it changes cryptographic behavior.

## 1. Design Summary

At a high level, Votex combines four separate cryptographic roles:

1. Human uniqueness comes from World ID.
2. Device-independent secret recovery comes from WebAuthn PRF-enabled passkeys.
3. Signing identity and vote/auth proofs use BabyJubJub EdDSA via `circomlibjs`.
4. Nullification and delegation privacy use BabyJubJub ElGamal plus Groth16 proofs.

The system is intentionally hybrid:

- World ID answers "is this a unique person?"
- the passkey answers "can this person deterministically recover the same local secret?"
- EdDSA answers "can this identity sign?"
- ElGamal and Groth16 answer "can this state transition be hidden but still constrained?"

## 2. Active Dependencies

### Browser/runtime package dependencies

| Dependency | Role | Active usage |
|---|---|---|
| `circomlibjs` | BabyJubJub EdDSA implementation and subgroup checks | `src/services/eddsaService.ts` |
| `snarkjs` | Groth16 proof generation and verification | `src/services/zkProofService.ts`, `src/workers/zkProofWorker.ts` |
| `blake-hash` | BLAKE-512 used in EdDSA-compatible scalar derivation from seed | `src/services/eddsaService.ts` |
| `@worldcoin/idkit` | World ID request widget and result types | `src/components/WorldIDSignIn.tsx`, `src/components/WorldIdRequestWidget.tsx` |

### Edge-function URL imports

| Dependency | Role | Active usage |
|---|---|---|
| `https://esm.sh/circomlibjs@0.1.7?bundle` | Edge-side EdDSA verification | `supabase/functions/_shared/eddsa.ts` |
| `https://esm.sh/@noble/curves@1.8.2/secp256k1` | RP request signing | `supabase/functions/rp-signature/index.ts` |
| `https://esm.sh/@noble/hashes@1.8.0/sha3` | Keccak-256 for RP request signing | `supabase/functions/rp-signature/index.ts` |
| `https://esm.sh/@noble/hashes@1.8.0/utils` | byte/hex helpers for RP request signing | `supabase/functions/rp-signature/index.ts` |
| `https://esm.sh/viem@2.26.2` | `keccak256` helper for World ID signal hash compatibility | `supabase/functions/register-keypair/index.ts` |

### Local crypto/protocol code

These are not third-party libraries, but they are cryptography-relevant and should be treated as part of the security surface:

- `src/services/eddsaService.ts`
- `src/services/deterministicKeyService.ts`
- `src/services/elGamalService.ts`
- `src/services/discreteLogService.ts`
- `src/services/elGamalTallyService.ts`
- `src/services/kAnonymityNullificationService.ts`
- `src/services/zkProofService.ts`
- `src/services/parallelZkProofService.ts`
- `src/services/passkeyService.ts`
- `supabase/functions/_shared/eddsa.ts`
- `supabase/functions/register-keypair/index.ts`
- `supabase/functions/worldid-session/index.ts`
- `supabase/functions/rp-signature/index.ts`

## 3. Primitives and Groups

### 3.1 BabyJubJub group

The repo uses the standard `circomlib` BabyJubJub parameters:

- subgroup order `q`:
  - `2736030358979909402780800718157159386076813972158567259200215660948447373041`
- field modulus `p`:
  - `21888242871839275222246405745257275088548364400416034343698204186575808495617`
- twisted Edwards parameters:
  - `a = 168700`
  - `d = 168696`
- base point:
  - `Gx = 5299619240641551281634865583518297030282874472190772894086521144482721001553`
  - `Gy = 16950150798460657717958625567821834550301663161624707787222815936182638968203`

Those constants are defined in `src/services/crypto/constants.ts`, and the code comments explicitly state they must match `circomlib`.

### 3.2 Hashes and KDFs

The active hash/KDF usage is:

- WebAuthn PRF / hmac-secret:
  - root secret material from the authenticator
- HKDF-SHA256:
  - derives versioned 32-byte seeds from passkey output and authority secrets
- SHA-256:
  - hashes vote/authority messages into field elements before EdDSA signing
  - hashes `pk_x || pk_y` into the World ID binding signal
  - derives session verifier hashes
  - hashes session tokens before storing them server-side
- BLAKE-512:
  - used as part of EdDSA-compatible scalar derivation from the 32-byte seed
- Keccak-256:
  - used for World ID API signal-hash compatibility and RP request signing

Random scalar generation for ElGamal and nullification randomness uses:

- `crypto.getRandomValues(32 bytes) % q`

That is simple and practical, but it is reduction-based sampling rather than rejection sampling, so it is not a perfectly uniform scalar sampler in the strictest sense.

### 3.3 Signature primitives

There are two distinct signature schemes in the repo:

1. BabyJubJub EdDSA-Poseidon
   - used for vote signatures and authority ownership proofs
   - implemented with `circomlibjs`

2. secp256k1 signature over Ethereum-prefixed messages
   - used only for RP context signing for World ID v4 request flows
   - implemented in `supabase/functions/rp-signature/index.ts`

### 3.4 Zero-knowledge proof system

The repo uses:

- Circom 2.1.x circuit definitions
- Groth16 proving/verifying via `snarkjs`
- circuit artifacts:
  - `public/circuits/nullification_xor.wasm`
  - `public/circuits/nullification_xor_final.zkey`
  - `public/circuits/verification_key_xor.json`

## 4. Key Material Model

## 4.1 Voter secret root: passkey PRF

The root secret is not a repo-generated random secret. It comes from a PRF-capable WebAuthn authenticator.

Flow:

1. `src/services/passkeyService.ts` creates or uses a passkey.
2. The repo requests the PRF extension with domain salt:
   - `votex:bjj:v1`
3. The authenticator returns a 32-byte PRF result.
4. That PRF result becomes the root input for all deterministic voter key material.

Decision:

- the passkey is the root of recoverability
- the browser does not invent a long-lived voting secret on its own
- if the same passkey is synced or used through hybrid transport, the same PRF output is expected

Important implementation note:

- the code stores only the credential ID in local storage for convenience
- the PRF output itself is not persisted directly

## 4.2 Seed derivation

`src/services/eddsaService.ts` derives a 32-byte EdDSA seed using:

- HKDF salt:
  - `votex:eddsa:seed-derivation`
- info for voter keys:
  - `votex:eddsa:passkey-seed:v1`
- info for authority keys:
  - `votex:eddsa:authority-seed:v1`

Decision:

- HKDF gives explicit domain separation
- passkey-derived seeds and authority-secret-derived seeds live in separate namespaces
- the version string is part of the derivation contract

## 4.3 EdDSA public key derivation

The active signing/public-key flow is library-backed:

- `circomlibjs.buildEddsa()`
- `eddsa.prv2pub(seed)`

This is the active public-key derivation used for:

- vote signing
- authority ownership proofs
- public key registration with World ID

The repo explicitly rejects the identity point and checks curve/subgroup membership during verification.

## 4.4 Scalar derivation for ElGamal and circuits

The repo also derives a BabyJub-compatible scalar from the same 32-byte seed:

1. BLAKE-512 over the seed
2. `circomlibjs` pruning
3. little-endian scalar extraction
4. `>> 3`
5. reduction mod `q`

That scalar is used by the repo's older BabyJubJub arithmetic path:

- `pk = sk * G` checks
- ElGamal decryption
- nullification witness ownership checks

Decision:

- one deterministic seed drives both the vetted EdDSA path and the existing BabyJub/ElGamal path
- this keeps the signing key and encryption/circuit key aligned without forcing the rest of the codebase to abandon its scalar-based logic

## 4.5 Session storage model

The repo stores the following in `sessionStorage` for the active browser tab:

- keypair version
- seed hex
- scalar `k`
- public key coordinates

This is a deliberate UX/security tradeoff:

- it avoids long-term `localStorage` persistence
- but it still means private key material is serialized in browser-managed storage for the session lifetime

That is unusual enough to document explicitly. The comments say "never store" for the scalar in an abstract sense, but the active implementation does cache it for the session.

## 5. World ID Binding

## 5.1 What gets bound

World ID is used to bind:

- an RP-scoped nullifier hash
- to a BabyJubJub public key

The app-defined signal is:

- `signal = SHA256(pk_x || pk_y)`

This is computed client-side in `src/services/deterministicKeyService.ts`.

## 5.2 Request-context signing

`supabase/functions/rp-signature/index.ts` generates a signed RP context for World ID v4 request flows.

It uses:

- secp256k1
- Ethereum signed message prefixing
- Keccak-256

This is not a generic wallet feature. It exists specifically to match the RP signing algorithm expected by World ID request widgets.

Decision:

- the repo reimplements the World ID server signing behavior locally in an edge function
- the stated reason is to avoid `esm.sh` bundling issues in Supabase edge functions

This is not a custom primitive, but it is a custom implementation of an upstream algorithm.

## 5.3 Registration

`supabase/functions/register-keypair/index.ts`:

1. receives the public key, signal, and World ID result
2. verifies the World ID proof using the World ID verify endpoint
3. recomputes the expected signal from the public key
4. rejects mismatches
5. stores the `nullifier_hash -> public key` binding

Important distinction:

- the app's signal itself is `SHA256(pk_x || pk_y)`
- but the World ID verify API expects a signal hash format compatible with its own field conventions, so the edge function also computes:
  - `keccak256(signal) >> 8`

Those are separate layers:

- SHA-256 binds the repo's key to the signal string
- Keccak-derived hashing exists for World ID API compatibility

## 5.4 Returning-user session binding

The repo also binds a World ID session to a passkey-derived verifier:

- `verifierHash = SHA256(prfSecret || "votex:session:v1")`

`src/services/worldIdSessionService.ts` and `supabase/functions/worldid-session/index.ts` use that verifier hash to ensure:

- the same World ID nullifier can only restore a session with the same passkey-derived verifier
- the verifier is registered only while processing a World ID proof that is bound to the same public key
- later sessions must match the stored verifier

Decision:

- World ID proves uniqueness
- the verifier hash proves continuity with the same passkey-backed local secret

## 6. EdDSA Signing

## 6.1 Active scheme

The active signature path is `circomlibjs` EdDSA-Poseidon on BabyJubJub.

Used in:

- `src/services/signatureService.ts`
- `src/services/authorityOwnershipProofService.ts`
- `supabase/functions/_shared/eddsa.ts`
- `supabase/functions/authority-link/index.ts`

The old custom Schnorr-style SHA-256 path is no longer the active implementation.

## 6.2 Message-to-field convention

Before calling `signPoseidon`, the repo hashes the message string with SHA-256 and reduces it mod `q`.

So the active signing input is:

- `msgField = SHA256(message) mod q`
- `signature = signPoseidon(seed, msgField)`

This is an application-defined prehash convention.

It is important because it means the repo is not signing arbitrary structured field elements directly. It is signing a deterministic field element derived from a UTF-8 message string.

This is not inherently wrong, but it is one of the custom decisions in the stack.

## 6.3 Vote signatures

Vote signing lives in `src/services/signatureService.ts`.

Signed message format:

- `${electionId}:${choice}:${timestamp}`

Serialized signature payload:

- `R8.x`
- `R8.y`
- `S`
- `message`

The client submits the payload to the `vote-tracking-write` edge function. The
function validates the World ID session, participant binding, election state,
timestamp, and EdDSA signature before calling the service-role-only
`cast_vote_atomic` database function. The canonical vote, tracking row, and
receipt are committed in one transaction; direct client writes are blocked.

Ballot choices are intentionally public under World ID-derived pseudonyms in
this pre-production design. This protects the real-world identity from being
written to the Votex ledger, but it is not full ballot secrecy and pseudonymous
activity may be linkable across elections.

## 6.4 Authority ownership proofs

Authority linking uses the same EdDSA path with a different message.

Message format:

- `votex:authority-link:v1:${authUserId}:${pkx}:${pky}:${authorityName}:${issuedAt}`

Properties:

- explicit domain separation via the `votex:authority-link:v1` prefix
- proof freshness via `issuedAt`
- server-side verification of exact message equality

`supabase/functions/authority-link/index.ts` additionally enforces:

- max proof age
- small future skew allowance
- public-key and nonce point validation
- identity-point rejection
- subgroup membership via `circomlibjs`

## 7. BabyJubJub ElGamal

## 7.1 What is custom here

The ElGamal path is not delegated to a vetted external library. The repo owns the math in `src/services/elGamalService.ts`.

That file implements:

- twisted Edwards point representation
- point addition
- double-and-add scalar multiplication
- ElGamal encryption in the exponent
- ciphertext subtraction
- XOR-accumulator helper operations

This is one of the biggest custom-crypto surfaces in the repository.

## 7.2 Encryption model

The scheme is ElGamal in the exponent over BabyJubJub:

- public key `H = sk * G`
- encrypt integer `m` as:
  - `C1 = r * G`
  - `C2 = m * G + r * H`

This is used for:

- nullification bits
- accumulator state
- delegation indices

Decision:

- plaintexts are intentionally tiny integers
- the scheme is designed around tallying/privacy workflows, not arbitrary large-message encryption

## 7.3 XOR accumulator model

The nullification design uses an encrypted XOR accumulator rather than an additive nullification counter.

For a nullification bit `x` and existing accumulator `[[y]]`:

- fresh encryption `[[x]]`
- conditional gate `[[x' y]]` where `x' = 2x - 1`
- new accumulator computed publicly as:
  - `[[x]] - [[x' y]]`

This keeps the final decrypted state binary:

- `0` means vote remains valid
- `1` means vote is nullified

The design is unusual, but it matches the current circuit and tally code.

**Re-nullification toggling is intentional.** Because the accumulator is an
encrypted XOR, each real nullification (`x = 1`) flips the voter's bit. A second
real nullification flips it back (`1 → 0`), making the vote valid again. This is
a feature, not a gap: a coerced voter can privately flip their validity bit in
either direction, and an observer (including the coercer) cannot tell from the
accumulator state which direction any given flip went, nor whether a given voter
is currently nullified, without the authority key. The write path therefore does
**not** enforce one-shot nullification — doing so would break this property.
Server-side, the trusted write path still requires a fresh valid proof and the
correct current accumulator version for every flip (see §9.5).

## 8. Decryption and Discrete Log Recovery

The authority does not solve general discrete logs on demand.

Instead:

1. decryption computes `mG = C2 - sk*C1`
2. the discrete log of `mG` is recovered by walking `n*G` for small `n` and
   matching the point string, memoized for the session

Files:

- `src/services/elGamalTallyService.ts`

Decision:

- this is practical because the plaintext space is small and bounded
- it would not scale to arbitrary message space

Used for:

- nullification results (`0` or `1`)
- delegation indices (`0..participantCount-1`)

This is an important nonstandard design choice, but the recovery now happens
**locally** in the tally code. Earlier versions read the point→value mapping
from an openly-writable `discrete_log_lookup` table; that table let anyone with
the anon key plant incorrect mappings and corrupt a tally (tally-decode
poisoning). The table's INSERT policy was locked to the service role
(migration `20260611100300`), and the tally path no longer trusts it — it
computes the mapping itself. The discrete log is tiny (0/1 for nullification
bits, bounded by participant count for delegation indices), so the local walk
costs milliseconds.

## 9. Nullification Proofs

## 9.1 Active circuit

The active circuit is:

- `circuits/nullification_xor.circom`

It proves:

1. `x` is binary
2. if `x = 1`, the voter knows a matching private key for `pk_voter`
3. the fresh ElGamal ciphertext is valid
4. the conditional gate output is valid

It does not prove the final accumulator update directly inside the circuit. The final subtraction is done publicly outside the circuit.

## 9.2 Proving flow

The active app path is:

- `src/services/kAnonymityNullificationService.ts`
- `src/services/parallelZkProofService.ts`
- `src/workers/zkProofWorker.ts`

Proof generation uses:

- `snarkjs.groth16.fullProve(...)`

The worker path allows multiple proofs to be generated in parallel in the browser.

## 9.3 Standalone verification helper

Client-side proof verification lives in `src/services/parallelZkProofService.ts`
(`verifyNullificationProof`). It is a convenience/standalone helper only — it is
**not** relied on for soundness, because a client cannot be trusted to verify
its own proof. The authoritative verification happens server-side (see §9.5).

## 9.4 Artifact loading model

Circuit artifacts are loaded from:

- `/circuits/` by default
- or `VITE_CIRCUIT_FILES_URL` if configured

The *client-loaded* artifacts (`nullification_xor.wasm`, `..._final.zkey`,
`verification_key_xor.json`, loadable from `/circuits/` or
`VITE_CIRCUIT_FILES_URL`) are trusted only by the proving browser. Swapping them
can only break or self-DoS the local prover; it cannot forge an accepted
nullification, because the authoritative verification key is hard-coded into the
edge function and is not read from these files (see §9.5).

## 9.5 Server-side proof verification (authoritative)

Nullifications are written exclusively through the `nullification-write` edge
function, which **verifies every Groth16 proof before any state changes** and
binds the proof's public signals to the real protocol state:

- `supabase/functions/nullification-write/index.ts` calls
  `verifyNullificationProofPayload` (`_shared/nullification.ts`) against a
  verification key hard-coded in `_shared/verificationKeyXor.ts` — it is not
  read from the database or any client-supplied file, so it cannot be swapped at
  the trust boundary.
- The verified public signals are checked by byte equality against the
  registered authority key, the targeted participant's registered key, and the
  stored accumulator ciphertext and version. A prover therefore cannot inject
  adversarial points or target another voter's slot without that voter's key.
- Persistence goes through the transactional `submit_nullification_batch`
  SECURITY DEFINER RPC (migration `20260422000000`), which takes `FOR UPDATE`
  row locks and is all-or-nothing. The `nullifications` and
  `nullification_accumulators` tables reject all direct client writes; the RPC
  is granted only to the service role.

> Historical note: earlier revisions of this document stated that the write path
> "does not verify the proof." That is **no longer accurate** — the
> `nullification-write` function makes verification mandatory. The client-side
> helper in `parallelZkProofService.ts` is not relied on for soundness.

The remaining real caveat is the **trusted setup** (see §9.6), not the write
path.

## 9.6 Trusted setup (documented limitation)

`public/circuits/nullification_xor_final.zkey` was produced by `circuits/compile.sh`
as a **single-contributor** Groth16 phase-2 setup: one `snarkjs zkey contribute`
seeded from local `/dev/urandom`, with no multi-party ceremony, no public
randomness beacon, and no published transcript. Phase 1 reuses the legitimate
Hermez `powersOfTau28_hez_final_16`.

Groth16 soundness depends on the phase-2 toxic waste being discarded. Whoever ran
`compile.sh` and retained that entropy could, in principle, forge a proof the
server would accept — bypassing the `sk_voter * G == pk_voter` ownership
constraint. For a research/prototype deployment this is an accepted, documented
limitation. Before any production use, run a real multi-party ceremony and
publish the transcript; the procedure is in `docs/TRUSTED_SETUP_RUNBOOK.md`.

## 10. Delegation Privacy

Delegation is private, but only in a narrow sense.

The delegator encrypts the delegate's participant index under the election authority's BabyJubJub public key.

Files:

- `src/services/delegationService.ts`
- `src/services/tallyService.ts`

Properties:

- anyone can see that a delegation record exists
- only the authority can decrypt which participant index was chosen
- the authority resolves weights at tally time

Important note:

- the cryptography here hides the delegate choice
- it does not, by itself, prove the delegator authorized that delegation

Authorization for delegation creation/revocation depends on application/database controls, not on a cryptographic signature or proof attached to each delegation record.

## 11. Tally Flow

The tally flow is implemented in `src/services/tallyService.ts`.

At tally time:

1. the authority derives key material from the authority secret
2. the scalar is used as the BabyJub/ElGamal private key
3. all accumulators are decrypted through the discrete-log lookup table
4. all delegations are decrypted to participant indices
5. delegation weights are resolved
6. final per-voter results are written through `authority-tally-write`

Decision:

- the same deterministic authority secret feeds both authority-link EdDSA identity and tally-time ElGamal decryption

This keeps operational UX simple, but it also means the authority secret is highly sensitive because it controls both identity proofing and tally decryption.

## 12. What Is Custom or Out of the Ordinary

The repo uses vetted libraries in important places, but the overall protocol is not "off-the-shelf."

Notable custom or unusual decisions:

- passkey PRF output is used as the deterministic root secret for voter identity
- EdDSA is library-backed, but the repo defines its own `SHA256(message) mod q` prehash convention before `signPoseidon`
- the repo derives a second scalar from the same seed to preserve compatibility with custom BabyJub ElGamal and circuit ownership checks
- the ElGamal/BabyJub arithmetic is locally implemented rather than delegated to a well-known library
- private key material is cached in `sessionStorage` for the session lifetime
- decryption relies on small-bounded discrete-log recovery (computed locally at tally time)
- the World ID RP-signature logic is reimplemented locally in an edge function
- nullification proving is browser-side and artifact-driven, but verification is mandatory server-side
- ElGamal/nullification randomness is generated by modular reduction of 32 random bytes instead of rejection sampling
- the Groth16 trusted setup is a single-contributor ceremony (documented limitation, see §9.6)

These are not all bugs, but they are all design decisions that materially affect the security model.

## 13. Active File Map

### Key derivation and signing

- `src/services/passkeyService.ts`
- `src/services/eddsaService.ts`
- `src/services/deterministicKeyService.ts`
- `src/services/signatureService.ts`
- `src/services/authorityOwnershipProofService.ts`
- `supabase/functions/_shared/eddsa.ts`
- `supabase/functions/authority-link/index.ts`

### World ID and session binding

- `src/components/WorldIDSignIn.tsx`
- `src/services/worldIdSessionService.ts`
- `supabase/functions/rp-signature/index.ts`
- `supabase/functions/register-keypair/index.ts`
- `supabase/functions/worldid-session/index.ts` (+ `handler.ts`)
- `supabase/functions/register-participant/index.ts`

### Encryption, nullification, delegation, tally

- `src/services/elGamalService.ts`
- `src/services/elGamalTallyService.ts`
- `src/services/accumulatorService.ts`
- `src/services/nullificationService.ts`
- `src/services/kAnonymityNullificationService.ts`
- `src/services/delegationService.ts`
- `src/services/tallyService.ts`
- `supabase/functions/nullification-write/index.ts` (authoritative proof verification)
- `supabase/functions/delegation-write/index.ts`

### ZK artifacts

- `circuits/nullification_xor.circom`
- `circuits/analyze.sh`
- `circuits/STATIC_ANALYSIS.md`
- `circuits/ZKLEAN_MODELING.md`
- `circuits/compile.sh`
- `src/services/parallelZkProofService.ts`
- `src/workers/zkProofWorker.ts`
- `supabase/functions/_shared/nullification.ts` (server-side proof verification)
- `supabase/functions/_shared/verificationKeyXor.ts` (hard-coded verification key)
- `public/circuits/nullification_xor.wasm`
- `public/circuits/nullification_xor_final.zkey`
- `public/circuits/verification_key_xor.json`

### Legacy or non-active crypto-adjacent helpers

- `circuits/nullification.circom`
  - legacy additive circuit kept for reference

## 14. Circuit Static Analysis

The repository now includes an explicit Circom static-analysis entrypoint:

```bash
npm run analyze:circuits
```

That script runs Trail of Bits `circomspect` over both Circom files in `circuits/`:

- `circuits/nullification_xor.circom` (active XOR accumulator circuit)
- `circuits/nullification.circom` (legacy additive circuit kept for reference)

CI installs `circomspect` and fails the `circuit-analysis` job if the analyzer reports issues. When the Rust `circom` compiler is also installed locally, the same script runs `circom --inspect` for both circuits.

Latest local run on 2026-05-19:

- `circomspect circuits/nullification_xor.circom`: no warning- or error-level issues found.
- `circomspect circuits/nullification.circom`: no warning- or error-level issues found.
- `circom --inspect` completed for both circuits. The only warnings were `CA02` warnings inside imported `circomlib` templates (`CompConstant`, `EscalarMulFix`, `EscalarMulAny`), not Votex-owned templates.

The captured tool output and `INFO`-level `circomspect` notes are checked in at `circuits/STATIC_ANALYSIS.md`.

The zkLean modeling path is documented in `circuits/ZKLEAN_MODELING.md`.

## 15. Open Questions / Limits of What This Repo Shows

1. Vote casting is now server-enforced. The unvalidated `insert_vote` RPC was
   dropped (migration `20260611100400`); votes go through the
   `vote-tracking-write` `cast-vote` action, which validates the World ID
   session and verifies the EdDSA vote signature against the voter's registered
   participant key before inserting. Direct client inserts to `votes` are
   blocked by RLS.

2. Nullification proof verification is enforced on the write path (see §9.5).

3. The main remaining cryptographic caveat is the single-contributor trusted
   setup (§9.6).

4. Authorization properties depend partly on database RLS policies and
   edge-function behavior. The full schema is now codified under
   `supabase/migrations/` (including the previously dashboard-only base tables),
   and the lockdown migrations route every sensitive write through a
   session-validating or ownership-checking edge function.

## 16. Bottom Line

The cryptography in this repo is a mixed system:

- good use of vetted libraries for EdDSA, subgroup checks, Groth16, and World ID request handling
- significant custom protocol and arithmetic around BabyJubJub ElGamal, XOR accumulators, discrete-log decoding, and storage-path orchestration

The most standard parts are:

- `circomlibjs` EdDSA-Poseidon
- `snarkjs` Groth16
- WebAuthn PRF
- noble secp256k1/Keccak usage for RP signatures

The least standard parts are:

- custom Edwards arithmetic and ElGamal
- custom message prehash convention for EdDSA
- small-bounded discrete-log recovery (computed locally)
- the single-contributor Groth16 trusted setup (§9.6)

If this document is kept up to date, it should be treated as the reference map for the repo's active cryptographic decisions.
