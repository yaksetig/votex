# XOR Nullification Circuit

This directory contains the Circom circuits for anonymous vote nullification using Groth16 ZK-SNARKs.

## Circuits

### `nullification_xor.circom` (active)

XOR-based accumulator circuit. Each nullification XORs the voter's bit into an encrypted running accumulator, so the Election Authority only ever sees 0 or 1 at tally time (no count leakage).

## Prerequisites

- [circom](https://docs.circom.io/getting-started/installation/) (v2.1.6+)
- [circomspect](https://github.com/trailofbits/circomspect) (`cargo install circomspect`)
- [snarkjs](https://github.com/iden3/snarkjs) (`npm install -g snarkjs`)
- Node.js 18+

## Static Analysis

Run the circuit analysis script from the repository root:

```bash
npm run analyze:circuits
```

This runs `circomspect` against both checked-in Circom files:

- `nullification_xor.circom` (active)

When the `circom` compiler is installed, the same script also runs `circom --inspect` for both circuits. CI installs and enforces `circomspect`; the compiler `--inspect` pass is kept in the local script because the Rust Circom compiler is not an npm dependency.

Current status as of 2026-09-09:

- `circomspect nullification_xor.circom`: no warning- or error-level issues found.
- `circom --inspect` completes. It reports `CA02` notes from imported `circomlib` templates and one for the intentionally unused output bits of the `election_id` range check (see `STATIC_ANALYSIS.md`).

The captured output and `INFO`-level notes are checked in at [`STATIC_ANALYSIS.md`](./STATIC_ANALYSIS.md).

For the formal-verification path, see [`ZKLEAN_MODELING.md`](./ZKLEAN_MODELING.md).

## Compilation

Run the compile script from this directory:

```bash
cd circuits
chmod +x compile.sh
./compile.sh
```

This will:

1. Install `circomlib` (if not already present)
2. Compile `nullification_xor.circom` to R1CS + WASM
3. Download the Powers of Tau ceremony file (~50 MB)
4. Generate the Groth16 proving key (Phase 2 setup)
5. Contribute to the ceremony
6. Export the verification key
7. Copy artifacts to `../public/circuits/` and regenerate `supabase/functions/_shared/verificationKeyXor.ts`

The artifacts are SHA-256 pinned in `release.config.json` (`circuitArtifacts`),
checked by `npm run release:check` and `preproductionBoundaries.test.ts`. After
a rebuild, update those pins in the same commit, or CI fails on purpose.

## Output Artifacts

After compilation, the following files are placed in `public/circuits/`:

| File | Purpose |
|------|---------|
| `nullification_xor.wasm` | Circuit witness generator |
| `nullification_xor_final.zkey` | Groth16 proving key |
| `verification_key_xor.json` | Verification key export; the edge verifier embeds it via `_shared/verificationKeyXor.ts` (no client-side verification) |

## Hosting on Supabase Storage

For production, upload the compiled artifacts to Supabase Storage:

1. Create a `circuits` bucket in your Supabase project (set to public)
2. Upload all three files from `public/circuits/`
3. Set `VITE_CIRCUIT_FILES_URL` in your `.env` to the bucket's public URL

## XOR Circuit Overview

The `nullification_xor.circom` circuit proves correct computation of a single XOR-gate step on an encrypted accumulator, without revealing the voter's nullification bit `x`.

**Protocol:**

```
x' = 2x - 1                                    maps {0,1} -> {-1,1}
[[x'y]] = (sG + x'*acc_c1, sH + x'*acc_c2)    conditional gate
new_acc = [[x]] - [[x'y]]                       XOR accumulator update (public)
```

Since `x' in {-1,1}`, the operation `x' * P` on an Edwards curve point is conditional negation: `(x'*px, py)`, because `-(px, py) = (-px, py)`.

**Public inputs:**

| Signal | Description |
|--------|-------------|
| `ciphertext[4]` | Fresh ElGamal encryption `[[x]] = (rG, xG + rH)` |
| `gate_output[4]` | Conditional gate `[[x'y]]` |
| `accumulator[4]` | Current XOR accumulator `[[y]]` |
| `pk_voter[2]` | Voter's BabyJubJub public key |
| `pk_authority[2]` | Election authority's public key `H` |
| `election_id` | Election UUID as a 128-bit integer (binds the proof to one election) |

**Private inputs:** `x` (nullification bit), `r` (encryption randomness), `s` (gate randomness), `sk_voter`

**Constraints verified:**

1. `x` is binary (0 or 1)
2. If `x=1`: voter's public key matches their private key (`pk_voter = sk_voter * G`)
3. Fresh ciphertext is valid ElGamal: `C1 = r*G`, `C2 = x*G + r*H`
4. Gate output is correctly computed: `gate_c1 = s*G + x'*acc_c1`, `gate_c2 = s*H + x'*acc_c2`

The new accumulator `[[x XOR y]] = [[x]] - [[x'y]]` is computed publicly (no circuit constraint needed).
