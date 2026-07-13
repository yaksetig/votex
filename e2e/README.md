# Browser lifecycle coverage

`election-lifecycle.spec.ts` runs the product through first-time World ID and
passkey onboarding, election creation, encrypted delegation and revocation,
participant registration, EdDSA vote signing, public receipt verification,
six-slot dummy nullification orchestration, authority sign-in, early closure,
and final tally persistence. The same critical path runs on desktop and mobile;
the six-slot nullification branch runs once on desktop.

The test keeps application cryptography in place for passkey key derivation,
vote signing and verification, delegation encryption, accumulator calculation,
and authority key derivation. World ID, WebAuthn hardware, Supabase, and proof
verification are deterministic test boundaries. Circuit correctness and the
real proving artifacts remain covered by the Vitest fixtures and Circomspect
CI job; the browser test uses a deterministic proof response so CI validates
the complete UI workflow without six concurrent prover workers making the run
machine-dependent.

The Vite aliases for those test doubles exist only when `VOTEX_E2E_MODE=true`,
which Playwright sets on its dedicated local server. Production builds cannot
resolve to the E2E stubs.
