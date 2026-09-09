# Pre-production dependency risk acceptance

Last reviewed: 2026-09-09.

`npm run audit:production` (`npm audit --omit=dev`) fails on any High or
Critical advisory that is not listed in `scripts/check-production-audit.mjs`.
That allowlist is currently **empty**: after the 2026-08-20 dependency
upgrades (`ws` overridden to a fixed release, `elliptic` re-rated Low) no
High/Critical production advisory remains, so nothing is accepted.

Residual, documented but not gated:

- `circomlibjs@0.1.7 -> ethers@5 -> elliptic` carries Low advisories against
  the ECDSA code path. Votex uses `circomlibjs` only for `buildEddsa` and
  BabyJubJub arithmetic; the affected ECDSA routines are not reachable. npm's
  suggested fix is a downgrade to the incompatible `circomlibjs@0.0.8`, which
  would change a cryptographic dependency and is rejected.
- Dev-only High advisories (`browserslist`, `js-yaml`, `@eslint/eslintrc`
  chains) do not ship in the production bundle or the edge functions.

Edge-function dependencies are resolved from `deno.lock` with `--frozen` in
CI, so a changed upstream artifact fails the build instead of deploying.

Any future acceptance must be added to the allowlist with the GHSA id, an
owner, a rationale, and an expiry date, and recorded here.
