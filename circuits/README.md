# XOR Nullification Circuit

This directory contains the Circom circuits for anonymous vote nullification using Groth16 ZK-SNARKs.

## Circuits

### `nullification_xor.circom` (active)

XOR-based accumulator circuit. Each nullification XORs the voter's bit into an encrypted running accumulator, so the Election Authority only ever sees 0 or 1 at tally time (no count leakage).

### `nullification.circom` (legacy)

Original additive-homomorphic circuit. Kept for reference.

## Prerequisites

- [circom](https://docs.circom.io/getting-started/installation/) (v2.1.6+)
- [snarkjs](https://github.com/iden3/snarkjs) (`npm install -g snarkjs`)
- Node.js 18+

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
7. Copy artifacts to `../public/circuits/`

## Output Artifacts

After compilation, the following files are placed in `public/circuits/`:

| File | Purpose |
|------|---------|
| `nullification_xor.wasm` | Circuit witness generator |
| `nullification_xor_final.zkey` | Groth16 proving key |
| `verification_key_xor.json` | Verification key (used client-side) |

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

**Private inputs:** `x` (nullification bit), `r` (encryption randomness), `s` (gate randomness), `sk_voter`

**Constraints verified:**

1. `x` is binary (0 or 1)
2. If `x=1`: voter's public key matches their private key (`pk_voter = sk_voter * G`)
3. Fresh ciphertext is valid ElGamal: `C1 = r*G`, `C2 = x*G + r*H`
4. Gate output is correctly computed: `gate_c1 = s*G + x'*acc_c1`, `gate_c2 = s*H + x'*acc_c2`

The new accumulator `[[x XOR y]] = [[x]] - [[x'y]]` is computed publicly (no circuit constraint needed).
