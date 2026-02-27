# Nullification Circuit

This directory contains the Circom circuit for anonymous vote nullification using Groth16 ZK-SNARKs.

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
2. Compile the circuit to R1CS + WASM
3. Download the Powers of Tau ceremony file (~50 MB)
4. Generate the Groth16 proving key (Phase 2 setup)
5. Contribute to the ceremony
6. Export the verification key
7. Copy artifacts to `../public/circuits/`

## Output Artifacts

After compilation, the following files are placed in `public/circuits/`:

| File | Purpose |
|------|---------|
| `nullification.wasm` | Circuit witness generator |
| `nullification_final.zkey` | Groth16 proving key |
| `verification_key.json` | Verification key (used client-side) |

## Hosting on Supabase Storage

For production, upload the compiled artifacts to Supabase Storage:

1. Create a `circuits` bucket in your Supabase project (set to public)
2. Upload all three files from `public/circuits/`
3. Set `VITE_CIRCUIT_FILES_URL` in your `.env` to the bucket's public URL

## Circuit Overview

The `nullification.circom` circuit proves that a voter correctly created an ElGamal encryption of their nullification message without revealing whether it is a real or dummy nullification.

**Public inputs:** `ciphertext`, `pk_voter`, `pk_authority`
**Private inputs:** `r` (randomness), `m` (message: 0 or 1), `sk_voter`

**Constraints verified:**
1. `m` is binary (0 or 1)
2. If `m=1`: voter's public key matches their private key (`pk_voter = sk_voter * G`)
3. Ciphertext is valid ElGamal: `C1 = r * G`, `C2 = m * G + r * pk_authority`
