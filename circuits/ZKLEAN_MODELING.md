# zkLean Modeling Plan

This repo can model the active nullification circuit in zkLean, but there are two materially different levels of assurance.

References:

- [zkLean README](https://github.com/GaloisInc/zkLean/blob/main/README.md)
- [Galois zkLean overview](https://www.galois.com/articles/zklean-a-dsl-for-zk-statement-verification)

## Practical Target

The first useful zkLean target is a formal model of the Votex nullification relation:

1. `x` is binary.
2. If `x = 1`, the declared voter public key equals `sk_voter * G`.
3. `ciphertext = (r * G, x * G + r * H)`.
4. `gate_output = (s * G + (2x - 1) * accumulator.c1, s * H + (2x - 1) * accumulator.c2)`.
5. The public accumulator update `ciphertext - gate_output` corresponds to the intended XOR accumulator step.

This is the proof that matters for protocol soundness: any satisfying witness should imply the intended Votex cryptographic statement.

## Direct Circom Import Path

zkLean's README describes two integration paths:

- write a custom extractor from another circuit system into zkLean
- use LLZK as an intermediate representation, including Circom-to-LLZK-to-zkLean flows

That means a direct import path should be possible, but it adds LLZK and the importer to the trusted computing base. It also means the proof would verify the extracted representation, not the raw `.circom` text by itself.

## Recommended Phases

### Phase 1: Protocol-Level Lean Model

Model the active `NullificationXOR` relation in Lean/zkLean with explicit structures for:

- BabyJubJub points
- public inputs
- private inputs
- ciphertext points
- gate-output points
- accumulator points

State and prove lemmas for the Votex-owned algebra:

- `x * (x - 1) = 0` implies `x = 0 or x = 1`
- `x = 1` plus `x * (pk_from_sk - pk_voter) = 0` implies `pk_from_sk = pk_voter`
- `x = 0` cleanly disables the voter key ownership check
- `2x - 1` maps `{0, 1}` to `{-1, 1}`
- conditional negation on Edwards points has the intended form `(x' * px, py)` for `x' in {-1, 1}`

### Phase 2: zkLean Circuit Encoding

Encode the relation using zkLean's `ZKBuilder` constraints and prove a soundness theorem against the protocol-level spec.

This phase can initially treat scalar multiplication and point addition as specified helper relations. That keeps the proof focused on Votex-owned composition logic.

### Phase 3: circomlib Component Coverage

Either:

- import the Circom circuit through LLZK into zkLean, then prove that the extracted circuit refines the same spec, or
- separately model/prove the relevant `circomlib` gadgets (`BabyAdd`, `EscalarMulFix`, `EscalarMulAny`, `Num2Bits_strict`) and connect them to the Votex model.

This is the phase needed before claiming end-to-end formal coverage of the concrete Circom implementation.

## Tooling Notes

The local machine has Lean/Lake installed, but zkLean currently pins its own Lean/mathlib stack. A real checked proof should live in a small Lake project pinned to the zkLean-supported toolchain, rather than relying on the repo's JavaScript toolchain.

## What zkLean Would Not Prove By Itself

A zkLean model does not automatically prove:

- trusted setup integrity
- correctness of generated `.zkey`, `.wasm`, or verifier artifacts
- correctness of `snarkjs`
- correctness of browser proof-generation wiring
- database or edge-function authorization behavior

Those remain separate verification/audit targets.
