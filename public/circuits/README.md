# XOR Nullification Circuit Artifacts

This directory contains the deployed proving artifacts for Votex's active
Groth16 XOR-nullification circuit. There is **no mock-proof or proof-bypass
mode**: every submitted proof is verified server-side against the checked-in
verification key.

## Active circuit

Source: `circuits/nullification_xor.circom`

Each proof establishes one encrypted XOR-accumulator step without revealing
the private nullification bit `x`.

```text
x' = 2x - 1
gate = (sG + x'·acc_c1, sH + x'·acc_c2)
new_acc = Enc(x; r) - gate
```

The legacy additive circuit at `circuits/nullification.circom` is retained for
reference and is not used by the application.

## Public inputs (17 field elements)

| Signal | Elements | Description |
|---|---:|---|
| `ciphertext` | 4 | Fresh ElGamal encryption `Enc(x; r)` |
| `gate_output` | 4 | Encrypted conditional XOR gate |
| `accumulator` | 4 | Current encrypted accumulator state |
| `pk_voter` | 2 | Target participant's BabyJubJub public key |
| `pk_authority` | 2 | Election authority's BabyJubJub public key |
| `election_id` | 1 | Election UUID as a 128-bit integer; binds the proof to one election |

The public signals are emitted in that order, so `publicSignals[16]` is the
election binding. `nullification-write` rejects a proof whose election signal
differs from the batch's election.

## Private inputs (4 field elements)

- `x`: binary nullification bit (`0` dummy, `1` actual)
- `r`: fresh encryption randomness
- `s`: gate rerandomization
- `sk_voter`: voter secret scalar, enforced against `pk_voter` when `x = 1`

The circuit constrains `r` and `s` to canonical nonzero scalars in the
BabyJubJub prime-subgroup range `(0, q)`.

## Deployed files

| File | Purpose |
|---|---|
| `nullification_xor.wasm` | Witness generator |
| `nullification_xor_final.zkey` | Groth16 proving key |
| `verification_key_xor.json` | Human-readable verification key export |

The Edge verifier does not download the JSON file from this directory. It uses
the source-controlled verification key in
`supabase/functions/_shared/verificationKeyXor.ts`.

## Building and production setup

Use `circuits/compile.sh` for local research builds. That script creates a
single-contributor phase-2 setup and is **not sufficient for production**.
Production artifacts require the multiparty procedure in
`docs/TRUSTED_SETUP_RUNBOOK.md`, a published transcript, and coherence checks
for the R1CS, WASM, zkey, JSON verification key, and Edge verification key.

Never add a client-side proof bypass. Local testing should use explicit test
fixtures; production and development submissions follow the same server proof
verification path.
