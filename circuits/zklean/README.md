# Votex zkLean Model

This directory contains a zkLean/Lean model of the Votex XOR nullification circuit.

The model is intentionally split at the same boundary as the Circom code:

- Votex-owned composition logic is modeled directly.
- `BabyAdd` is modeled by its algebraic constraints.
- Scalar-multiplication gadgets (`EscalarMulFix`, `EscalarMulAny`) are explicit helper outputs for now.

That boundary gives a useful first formal target without pretending that the whole imported `circomlib` stack has already been proven.

## Prerequisites

This Lake project expects the Galois zkLean repository to be checked out next to `votex`:

```text
Repos/
  votex/
  zkLean/
```

The dependency path is set in `lakefile.toml`:

```toml
[[require]]
name = "zkLean"
path = "../../../zkLean/zkLean"
```

If your checkout lives somewhere else, adjust that path.

## Build

From this directory:

```bash
lake build
```

## Files

- `Votex/NullificationXor.lean` contains the protocol model, zkLean circuit model, and core algebra lemmas.
