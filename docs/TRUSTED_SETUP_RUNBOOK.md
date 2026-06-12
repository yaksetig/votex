# Trusted Setup Runbook (Groth16 phase-2 ceremony)

## Why this exists

The current `public/circuits/nullification_xor_final.zkey` was produced by
`circuits/compile.sh` as a **single-contributor** phase-2 setup:

```sh
snarkjs groth16 setup build/nullification_xor.r1cs pot16_final.ptau nullification_xor_0000.zkey
snarkjs zkey contribute nullification_xor_0000.zkey nullification_xor_final.zkey \
  --name="Initial contribution" -e="$(head -c 64 /dev/urandom | xxd -p -c 256)"
```

Groth16 soundness depends on every phase-2 contributor discarding their secret
("toxic waste"). With a single local contribution, whoever ran the script could
forge proofs if they kept that entropy. This is acceptable for a
research/prototype deployment **only as a documented limitation** (see
`CRYPTOGRAPHY.md` §9.6). Before any production or real-stakes election, replace
it with a real multi-party ceremony using the procedure below.

Phase 1 (`powersOfTau28_hez_final_16.ptau` from the Hermez ceremony) is a
legitimate, widely-attested universal setup and can be reused as-is.

## Prerequisites

- `circom` and `snarkjs` installed (see `circuits/compile.sh`).
- The compiled constraint system `circuits/build/nullification_xor.r1cs`
  (regenerate with `circuits/compile.sh` if absent — it is gitignored).
- Three or more independent contributors on different machines/people. The
  ceremony is secure if **at least one** contributor is honest and discards
  their entropy.

## Procedure

1. **Generate the initial key** (coordinator):

   ```sh
   snarkjs groth16 setup build/nullification_xor.r1cs pot16_final.ptau nullification_xor_0000.zkey
   ```

2. **Each contributor in turn** takes the previous `.zkey`, contributes fresh
   entropy, and passes the output to the next contributor. Contributor _N_:

   ```sh
   snarkjs zkey contribute nullification_xor_000{N-1}.zkey nullification_xor_000{N}.zkey \
     --name="Contributor N (name/handle)" -v
   # enter independent randomness when prompted; do NOT reuse across contributors
   ```

   Each contributor should publish their `.zkey` hash and attest publicly that
   they discarded their entropy.

3. **Apply a public randomness beacon** as the final step (coordinator), so the
   result cannot be predicted even if all named contributors collude. Use a
   future, publicly-verifiable value (e.g. a Bitcoin/Ethereum block hash at a
   pre-announced height):

   ```sh
   snarkjs zkey beacon nullification_xor_000{last}.zkey nullification_xor_final.zkey \
     <BEACON_HEX> 10 --name="Final beacon"
   ```

4. **Verify the final key against the constraint system**:

   ```sh
   snarkjs zkey verify build/nullification_xor.r1cs pot16_final.ptau nullification_xor_final.zkey
   ```

   This must print `ZKey Ok!`. It confirms the `.zkey` corresponds to the
   committed circuit.

5. **Export and publish the verification key**:

   ```sh
   snarkjs zkey export verificationkey nullification_xor_final.zkey verification_key_xor.json
   ```

6. **Publish the full transcript**: each contributor's `.zkey` hash, names,
   attestations, the beacon source and height, and the final
   `snarkjs zkey verify` output.

## Deploying the new artifacts

The verification key is the trust anchor and is **hard-coded server-side**, not
read from a file at runtime. After regenerating:

1. Copy the new `nullification_xor_final.zkey`, `nullification_xor.wasm`, and
   `verification_key_xor.json` into `public/circuits/`.
2. Regenerate `supabase/functions/_shared/verificationKeyXor.ts` from the new
   `verification_key_xor.json` (it must match exactly, or every proof will be
   rejected server-side).
3. Redeploy the `nullification-write` edge function.
4. Confirm `nPublic` is still 16 and the IC point count is 17; the public-signal
   count check in `_shared/nullification.ts` must stay aligned with the circuit.

A mismatch between the client `.zkey` and the server verification key fails
closed — proofs are rejected, nothing is silently accepted.
