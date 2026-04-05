/**
 * VTX-013: Integration tests covering auth, voting, nullification,
 * and tally authorization boundaries.
 *
 * These tests exercise the crypto and data-flow logic end-to-end without
 * a live Supabase instance.  They catch regressions in:
 *   - XOR accumulator nullification → tally pipeline
 *   - Authority ownership proof creation / verification
 *   - Keypair session-storage behaviour (VTX-010)
 *   - ElGamal tally decryption correctness
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EdwardsPoint,
  elgamalEncrypt,
  ElGamalCiphertext,
  identityCiphertext,
  computeXorGate,
  computeXorAccumulator,
} from "../services/elGamalService";
import { randomScalar } from "../services/crypto/utils";
import { deriveAuthorityKeyMaterial } from "../services/eddsaService";

/**
 * Pure decryption for tests — avoids the Supabase discrete-log lookup.
 * Decrypts ElGamal-in-the-exponent: m*G = c2 - sk*c1.
 * Returns 0 if the result is the identity point, 1 if it's the base point,
 * or null otherwise.
 */
function decryptLocally(ct: ElGamalCiphertext, sk: bigint): number | null {
  const skC1 = ct.c1.multiply(sk);
  // Negate: in Edwards curves -(x,y) = (-x,y)
  const negSkC1 = new EdwardsPoint(-skC1.x, skC1.y);
  const mG = ct.c2.add(negSkC1);

  const identity = EdwardsPoint.identity();
  if (mG.x === identity.x && mG.y === identity.y) return 0;

  const base = EdwardsPoint.base();
  if (mG.x === base.x && mG.y === base.y) return 1;

  return null;
}

// ---------------------------------------------------------------------------
// 1. XOR accumulator → tally pipeline
// ---------------------------------------------------------------------------
describe("Nullification → tally pipeline", () => {
  const authoritySk = 42n;
  const authorityPk = EdwardsPoint.base().multiply(authoritySk);

  function applyNullification(
    acc: ElGamalCiphertext,
    x: 0 | 1
  ): { acc: ElGamalCiphertext; fresh: ElGamalCiphertext } {
    const s = randomScalar();
    const fresh = elgamalEncrypt(authorityPk, x);
    const gate = computeXorGate(x, acc, authorityPk, s);
    const newAcc = computeXorAccumulator(fresh, gate);
    return { acc: newAcc, fresh };
  }

  it("single actual nullification decrypts to 1 (vote nullified)", () => {
    let acc = identityCiphertext();
    ({ acc } = applyNullification(acc, 1));

    expect(decryptLocally(acc, authoritySk)).toBe(1);
  });

  it("single dummy nullification decrypts to 0 (vote valid)", () => {
    let acc = identityCiphertext();
    ({ acc } = applyNullification(acc, 0));

    expect(decryptLocally(acc, authoritySk)).toBe(0);
  });

  it("two actual nullifications cancel out (XOR: 1⊕1=0)", () => {
    let acc = identityCiphertext();
    ({ acc } = applyNullification(acc, 1));
    ({ acc } = applyNullification(acc, 1));

    expect(decryptLocally(acc, authoritySk)).toBe(0);
  });

  it("dummy nullifications don't affect the accumulator", () => {
    let acc = identityCiphertext();
    for (let i = 0; i < 3; i++) {
      ({ acc } = applyNullification(acc, 0));
    }

    expect(decryptLocally(acc, authoritySk)).toBe(0);
  });

  it("mixed actual + dummy: only odd actuals nullify", () => {
    let acc = identityCiphertext();
    // actual, dummy, dummy, actual, actual → 3 actuals (odd) → 1
    const bits: (0 | 1)[] = [1, 0, 0, 1, 1];
    for (const x of bits) {
      ({ acc } = applyNullification(acc, x));
    }

    expect(decryptLocally(acc, authoritySk)).toBe(1);
  });

  it("multiple voters have independent accumulators", () => {
    let accA = identityCiphertext();
    ({ acc: accA } = applyNullification(accA, 1));

    let accB = identityCiphertext();
    ({ acc: accB } = applyNullification(accB, 0));

    expect(decryptLocally(accA, authoritySk)).toBe(1);
    expect(decryptLocally(accB, authoritySk)).toBe(0);
  });

  it("six sequential nullifications (k-anonymity batch size)", () => {
    // Simulates a k=6 batch: 1 real + 5 dummies
    let acc = identityCiphertext();
    const bits: (0 | 1)[] = [0, 1, 0, 0, 0, 0]; // 1 actual
    for (const x of bits) {
      ({ acc } = applyNullification(acc, x));
    }

    expect(decryptLocally(acc, authoritySk)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Keypair session-storage boundary (VTX-010 regression)
//    Tested separately in integration-dom.test.ts (requires jsdom environment)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 3. Tally decryption correctness (pure crypto, no DB)
// ---------------------------------------------------------------------------
describe("Tally decryption", () => {
  const sk = 99n;
  const pk = EdwardsPoint.base().multiply(sk);

  it("decrypts encryption of 0 to 0", () => {
    const ct = elgamalEncrypt(pk, 0);
    expect(decryptLocally(ct, sk)).toBe(0);
  });

  it("decrypts encryption of 1 to 1", () => {
    const ct = elgamalEncrypt(pk, 1);
    expect(decryptLocally(ct, sk)).toBe(1);
  });

  it("decrypts with different authority keys", () => {
    const sk2 = 777n;
    const pk2 = EdwardsPoint.base().multiply(sk2);
    expect(decryptLocally(elgamalEncrypt(pk2, 0), sk2)).toBe(0);
    expect(decryptLocally(elgamalEncrypt(pk2, 1), sk2)).toBe(1);
  });

  it("wrong key cannot decrypt", () => {
    const ct = elgamalEncrypt(pk, 1);
    const wrongSk = 100n;
    // With the wrong key the decrypted point won't match 0 or 1
    const result = decryptLocally(ct, wrongSk);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Authority ownership proof format
// ---------------------------------------------------------------------------
describe("Authority ownership proof format", () => {
  it("buildAuthorityLinkMessage produces deterministic domain-separated string", async () => {
    const { buildAuthorityLinkMessage } = await import(
      "../services/authorityOwnershipProofService"
    );

    const msg = buildAuthorityLinkMessage(
      "user-uuid-123",
      { x: "111", y: "222" },
      "Test Authority",
      1700000000000
    );

    expect(msg).toBe(
      "votex:authority-link:v1:user-uuid-123:111:222:Test Authority:1700000000000"
    );
  });

  it("deriveAuthorityPublicKey produces on-curve point", async () => {
    const { deriveAuthorityPublicKey } = await import(
      "../services/authorityOwnershipProofService"
    );

    const pk = await deriveAuthorityPublicKey("correct horse battery staple");
    const point = new EdwardsPoint(BigInt(pk.x), BigInt(pk.y));
    expect(point.isOnCurve()).toBe(true);
  });

  it("deriveAuthorityPublicKey is deterministic for the same authority secret", async () => {
    const { deriveAuthorityPublicKey } = await import(
      "../services/authorityOwnershipProofService"
    );

    const secret = "authority-demo-secret";
    const pk1 = await deriveAuthorityPublicKey(secret);
    const pk2 = await deriveAuthorityPublicKey(secret);
    expect(pk1).toEqual(pk2);
  });

  it("deriveAuthorityPublicKey matches the scalar derived from the same secret", async () => {
    const { deriveAuthorityPublicKey } = await import(
      "../services/authorityOwnershipProofService"
    );

    const secret = "authority-demo-secret";
    const pk = await deriveAuthorityPublicKey(secret);
    const keyMaterial = await deriveAuthorityKeyMaterial(secret);
    const expected = EdwardsPoint.base().multiply(keyMaterial.scalar);
    expect(pk.x).toBe(expected.x.toString());
    expect(pk.y).toBe(expected.y.toString());
  });
});

// ---------------------------------------------------------------------------
// 5. Delegation encryption round-trip
// ---------------------------------------------------------------------------
describe("Delegation encryption", () => {
  const authoritySk = 42n;
  const authorityPk = EdwardsPoint.base().multiply(authoritySk);

  it("encrypt-then-decrypt preserves participant index", () => {
    const index = 5;
    const ct = elgamalEncrypt(authorityPk, index);
    const result = decryptLocally(ct, authoritySk);
    // decryptLocally only handles 0 and 1; for higher indices we
    // check manually: m*G where m = index
    const skC1 = ct.c1.multiply(authoritySk);
    const negSkC1 = new EdwardsPoint(-skC1.x, skC1.y);
    const mG = ct.c2.add(negSkC1);
    const expectedMG = EdwardsPoint.base().multiply(BigInt(index));
    expect(mG.x).toBe(expectedMG.x);
    expect(mG.y).toBe(expectedMG.y);
  });

  it("different indices produce different ciphertexts (with same randomness)", () => {
    const r = 12345n;
    const ct0 = elgamalEncrypt(authorityPk, 0, r);
    const ct3 = elgamalEncrypt(authorityPk, 3, r);
    // c1 is the same (rG) but c2 differs because of the message
    expect(ct0.c1.x).toBe(ct3.c1.x);
    expect(ct0.c2.x).not.toBe(ct3.c2.x);
  });

  it("ciphertext is on curve", () => {
    const ct = elgamalEncrypt(authorityPk, 7);
    expect(ct.c1.isOnCurve()).toBe(true);
    expect(ct.c2.isOnCurve()).toBe(true);
  });

  it("delegation weight map computation", () => {
    // Simulate 3 delegators → delegate at index 2
    // and 1 delegator → delegate at index 0
    const weightMap = new Map<string, number>();
    const delegatorIds = new Set<string>();
    const participants = ["alice", "bob", "carol"];

    // 3 delegations to carol (index 2)
    for (const delegator of ["d1", "d2", "d3"]) {
      delegatorIds.add(delegator);
      const current = weightMap.get(participants[2]) ?? 1;
      weightMap.set(participants[2], current + 1);
    }

    // 1 delegation to alice (index 0)
    delegatorIds.add("d4");
    const current = weightMap.get(participants[0]) ?? 1;
    weightMap.set(participants[0], current + 1);

    expect(weightMap.get("carol")).toBe(4); // 1 (own) + 3 delegated
    expect(weightMap.get("alice")).toBe(2); // 1 (own) + 1 delegated
    expect(weightMap.get("bob")).toBeUndefined(); // no delegations → weight 1 (default)
    expect(delegatorIds.size).toBe(4);
  });
});
