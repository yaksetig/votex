/**
 * Protocol-level integration tests that run without a Supabase instance:
 * the XOR accumulator nullification → tally pipeline, ElGamal tally
 * decryption, authority key derivation, and delegation decoding.
 */

import { describe, it, expect } from "vitest";
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
import { decodeDelegations, type StoredDelegation } from "../services/delegationDecoding";
import { ensureDiscreteLogTable } from "../services/elGamalTallyService";

const AUTHORITY_TEST_SECRET = `votex-auth-v1_${"1".repeat(64)}`;

/**
 * Synchronous decryption for the pipeline tests below, which only need to
 * distinguish plaintext 0 (identity) from 1 (base point); the production
 * decoder (decryptElGamalInExponent) is covered in nullificationClient.test.ts.
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
// 2. Tally decryption correctness (pure crypto, no DB)
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
// 3. Authority ownership proof format
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

    const pk = await deriveAuthorityPublicKey(AUTHORITY_TEST_SECRET);
    const point = new EdwardsPoint(BigInt(pk.x), BigInt(pk.y));
    expect(point.isOnCurve()).toBe(true);
  });

  it("deriveAuthorityPublicKey is deterministic for the same authority secret", async () => {
    const { deriveAuthorityPublicKey } = await import(
      "../services/authorityOwnershipProofService"
    );

    const secret = AUTHORITY_TEST_SECRET;
    const pk1 = await deriveAuthorityPublicKey(secret);
    const pk2 = await deriveAuthorityPublicKey(secret);
    expect(pk1).toEqual(pk2);
  });

  it("deriveAuthorityPublicKey matches the scalar derived from the same secret", async () => {
    const { deriveAuthorityPublicKey } = await import(
      "../services/authorityOwnershipProofService"
    );

    const secret = AUTHORITY_TEST_SECRET;
    const pk = await deriveAuthorityPublicKey(secret);
    const keyMaterial = await deriveAuthorityKeyMaterial(secret);
    const expected = EdwardsPoint.base().multiply(keyMaterial.scalar);
    expect(pk.x).toBe(expected.x.toString());
    expect(pk.y).toBe(expected.y.toString());
  });

  it("rejects human-memorable authority passwords", async () => {
    const { deriveAuthorityPublicKey } = await import(
      "../services/authorityOwnershipProofService"
    );

    await expect(deriveAuthorityPublicKey("correct horse battery staple")).rejects.toThrow(
      "generated votex-auth-v1 recovery key"
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Delegation encryption round-trip
// ---------------------------------------------------------------------------
describe("Delegation encryption", () => {
  const authoritySk = 42n;
  const authorityPk = EdwardsPoint.base().multiply(authoritySk);

  it("encrypt-then-decrypt preserves participant index", () => {
    const index = 5;
    const ct = elgamalEncrypt(authorityPk, index);
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
});

// ---------------------------------------------------------------------------
// 5. Undecodable delegations are reported, not fatal
// ---------------------------------------------------------------------------
describe("Delegation decoding at tally time", () => {
  const sk = 424242n;
  const authorityPk = EdwardsPoint.base().multiply(sk);
  const participants = [{ participant_id: "alice" }, { participant_id: "bob" }, { participant_id: "carol" }];

  function stored(id: string, delegator: string, index: number): StoredDelegation {
    const ct = elgamalEncrypt(authorityPk, index);
    return {
      id,
      election_id: "e",
      delegator_id: delegator,
      delegate_ct_c1_x: ct.c1.x.toString(),
      delegate_ct_c1_y: ct.c1.y.toString(),
      delegate_ct_c2_x: ct.c2.x.toString(),
      delegate_ct_c2_y: ct.c2.y.toString(),
      status: "active",
      created_at: new Date().toISOString(),
      revoked_at: null,
    };
  }

  it("keeps valid delegations and isolates an out-of-range one", async () => {
    await ensureDiscreteLogTable(participants.length);
    const good = stored("d-good", "bob", 2);          // bob -> carol
    const outOfRange = stored("d-bad", "alice", 10_000); // not in [0, 3)
    const self = stored("d-self", "carol", 2);         // carol -> carol

    const decoded = await decodeDelegations([good, outOfRange, self], participants, sk);

    expect(decoded.resolved).toEqual([
      { delegatorId: "bob", delegateIndex: 2, delegateParticipantId: "carol" },
    ]);
    expect(decoded.weightMap.get("carol")).toBe(2);
    expect([...decoded.delegatorIds]).toEqual(["bob"]);
    expect(decoded.invalidDelegations.map((d) => d.delegationId).sort()).toEqual(["d-bad", "d-self"]);
    // The invalid delegators are NOT marked as delegators, so their own ballots still count.
    expect(decoded.delegatorIds.has("alice")).toBe(false);
    expect(decoded.delegatorIds.has("carol")).toBe(false);
  });

  it("reports a delegation whose ciphertext is off-curve instead of throwing", async () => {
    const broken = { ...stored("d-broken", "alice", 1), delegate_ct_c2_x: "5" };
    const decoded = await decodeDelegations([broken], participants, sk);
    expect(decoded.resolved).toEqual([]);
    expect(decoded.invalidDelegations).toHaveLength(1);
    expect(decoded.invalidDelegations[0].delegatorId).toBe("alice");
  });
});
