# Votex documentation

| Document | Read it when |
|---|---|
| [../README.md](../README.md) | You want the product framing, the local development commands, and the configuration variables. |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | You are changing code: repository layout, what each test suite proves, migration replay, circuit rebuild, release entry point. |
| [../CRYPTOGRAPHY.md](../CRYPTOGRAPHY.md) | You need the protocol as implemented: key derivation, World ID binding, signatures, ElGamal/XOR accumulators, the nullification circuit and its server-side verification, tally, and the documented limitations. |
| [PREPRODUCTION_ARCHITECTURE.md](PREPRODUCTION_ARCHITECTURE.md) | You need the application boundaries: which edge function owns which write, what the fixed authority is, how ballots, delegations and nullifications flow. |
| [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) | You are deploying: workflow triggers, required secrets, live verification, GitHub settings the workflow cannot enforce. |
| [TRUSTED_SETUP_RUNBOOK.md](TRUSTED_SETUP_RUNBOOK.md) | You are preparing the production Groth16 ceremony. |
| [DEPENDENCY_RISK_ACCEPTANCE.md](DEPENDENCY_RISK_ACCEPTANCE.md) | You are reviewing `npm audit` output or the accepted-advisory policy. |
| [../circuits/README.md](../circuits/README.md) | You are touching the Circom circuit or its artifacts. |
| [../e2e/README.md](../e2e/README.md) | You are changing the browser lifecycle test or its stubs. |

Conventions: `CRYPTOGRAPHY.md` is the reference for *what the protocol is*;
`PREPRODUCTION_ARCHITECTURE.md` for *which component enforces it*; this
directory's runbooks for *how to operate it*. When the same fact appears in
more than one place, the others should link rather than restate.
