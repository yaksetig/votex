# Pre-production dependency risk acceptance

`circomlibjs@0.1.7` brings an old Ethers v5 dependency tree containing
`elliptic` and `ws` advisories. `npm audit` currently proposes replacing it with
the incompatible `circomlibjs@0.0.8`, which would change a cryptographic
dependency and violate the hardening scope.

Accepted advisory identifiers for this pre-production release:

- `GHSA-848j-6mx2-7j84` (`elliptic` risky primitive implementation)
- `GHSA-58qx-3vcg-4xpx` (`ws` uninitialized-memory disclosure)
- `GHSA-96hv-2xvq-fx4p` (`ws` fragmented-frame denial of service)

The application does not instantiate the transitive Ethers WebSocket provider;
Votex uses `circomlibjs` for local BabyJubJub EdDSA construction. This narrows
the reachable `ws` exposure but does not erase the supply-chain finding.

`npm run audit:production` permits only the advisory identifiers above and
fails for a new high/critical production advisory. Revisit this acceptance when
the cryptography dependency can be upgraded with protocol vectors and review.
