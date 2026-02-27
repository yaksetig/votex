import { describe, it, expect } from "vitest";
import {
  EdwardsPoint,
  elgamalEncrypt,
  negatePoint,
  subtractCiphertexts,
  computeXorGate,
  computeXorAccumulator,
  identityCiphertext,
  derivePublicKey,
} from "../services/elGamalService";
import { randomScalar } from "../services/crypto/utils";
import { CURVE_ORDER, FIELD_SIZE } from "../services/crypto/constants";

describe("negatePoint", () => {
  it("negates a point: -(x, y) = (-x, y)", () => {
    const p = EdwardsPoint.base();
    const neg = negatePoint(p);
    expect(neg.x).toBe((FIELD_SIZE - p.x) % FIELD_SIZE);
    expect(neg.y).toBe(p.y);
  });

  it("double negation returns original point", () => {
    const p = EdwardsPoint.base();
    const result = negatePoint(negatePoint(p));
    expect(result.x).toBe(p.x);
    expect(result.y).toBe(p.y);
  });

  it("negating identity gives identity", () => {
    const id = EdwardsPoint.identity();
    const neg = negatePoint(id);
    expect(neg.x).toBe(0n);
    expect(neg.y).toBe(1n);
  });

  it("P + (-P) = identity", () => {
    const p = EdwardsPoint.base();
    const neg = negatePoint(p);
    const sum = p.add(neg);
    expect(sum.x).toBe(0n);
    expect(sum.y).toBe(1n);
  });
});

describe("subtractCiphertexts", () => {
  it("[[a]] - [[a]] = identity ciphertext", () => {
    const pk = derivePublicKey(42n);
    const ct = elgamalEncrypt(pk, 1, 100n);
    const result = subtractCiphertexts(ct, ct);
    // c1 - c1 = identity, c2 - c2 = identity
    expect(result.c1.x).toBe(0n);
    expect(result.c1.y).toBe(1n);
    expect(result.c2.x).toBe(0n);
    expect(result.c2.y).toBe(1n);
  });
});

describe("identityCiphertext", () => {
  it("returns (O, O) where O is the identity point", () => {
    const id = identityCiphertext();
    expect(id.c1.x).toBe(0n);
    expect(id.c1.y).toBe(1n);
    expect(id.c2.x).toBe(0n);
    expect(id.c2.y).toBe(1n);
  });
});

describe("XOR gate computation", () => {
  const authorityPrivateKey = 123456789n;
  const authorityPublicKey = derivePublicKey(authorityPrivateKey);

  // Helper: decrypt ElGamal in the exponent
  function decrypt(
    ct: { c1: EdwardsPoint; c2: EdwardsPoint },
    sk: bigint
  ): EdwardsPoint {
    // m*G = c2 - sk*c1
    const skC1 = ct.c1.multiply(sk);
    return ct.c2.add(negatePoint(skC1));
  }

  it("XOR truth table: 0 XOR 0 = 0", () => {
    const acc = identityCiphertext(); // [[0]]
    const x = 0;
    const r = randomScalar(CURVE_ORDER);
    const s = randomScalar(CURVE_ORDER);

    const freshCt = elgamalEncrypt(authorityPublicKey, x, r);
    const gate = computeXorGate(x, acc, authorityPublicKey, s);
    const newAcc = computeXorAccumulator(freshCt, gate);

    const decrypted = decrypt(newAcc, authorityPrivateKey);
    // 0*G = identity
    expect(decrypted.x).toBe(0n);
    expect(decrypted.y).toBe(1n);
  });

  it("XOR truth table: 1 XOR 0 = 1", () => {
    const acc = identityCiphertext(); // [[0]]
    const x = 1;
    const r = randomScalar(CURVE_ORDER);
    const s = randomScalar(CURVE_ORDER);

    const freshCt = elgamalEncrypt(authorityPublicKey, x, r);
    const gate = computeXorGate(x, acc, authorityPublicKey, s);
    const newAcc = computeXorAccumulator(freshCt, gate);

    const decrypted = decrypt(newAcc, authorityPrivateKey);
    const G = EdwardsPoint.base();
    // 1*G = G
    expect(decrypted.x).toBe(G.x);
    expect(decrypted.y).toBe(G.y);
  });

  it("XOR truth table: 0 XOR 1 = 1", () => {
    // Build accumulator at [[1]]
    const r1 = randomScalar(CURVE_ORDER);
    const s1 = randomScalar(CURVE_ORDER);
    const acc0 = identityCiphertext();
    const ct1 = elgamalEncrypt(authorityPublicKey, 1, r1);
    const gate1 = computeXorGate(1, acc0, authorityPublicKey, s1);
    const acc1 = computeXorAccumulator(ct1, gate1);

    // Now XOR with 0
    const r2 = randomScalar(CURVE_ORDER);
    const s2 = randomScalar(CURVE_ORDER);
    const ct2 = elgamalEncrypt(authorityPublicKey, 0, r2);
    const gate2 = computeXorGate(0, acc1, authorityPublicKey, s2);
    const newAcc = computeXorAccumulator(ct2, gate2);

    const decrypted = decrypt(newAcc, authorityPrivateKey);
    const G = EdwardsPoint.base();
    expect(decrypted.x).toBe(G.x);
    expect(decrypted.y).toBe(G.y);
  });

  it("XOR truth table: 1 XOR 1 = 0", () => {
    // Build accumulator at [[1]]
    const r1 = randomScalar(CURVE_ORDER);
    const s1 = randomScalar(CURVE_ORDER);
    const acc0 = identityCiphertext();
    const ct1 = elgamalEncrypt(authorityPublicKey, 1, r1);
    const gate1 = computeXorGate(1, acc0, authorityPublicKey, s1);
    const acc1 = computeXorAccumulator(ct1, gate1);

    // Now XOR with 1
    const r2 = randomScalar(CURVE_ORDER);
    const s2 = randomScalar(CURVE_ORDER);
    const ct2 = elgamalEncrypt(authorityPublicKey, 1, r2);
    const gate2 = computeXorGate(1, acc1, authorityPublicKey, s2);
    const newAcc = computeXorAccumulator(ct2, gate2);

    const decrypted = decrypt(newAcc, authorityPrivateKey);
    expect(decrypted.x).toBe(0n);
    expect(decrypted.y).toBe(1n);
  });

  it("multiple XOR operations: 1 XOR 1 XOR 1 = 1", () => {
    let acc = identityCiphertext();

    for (let i = 0; i < 3; i++) {
      const r = randomScalar(CURVE_ORDER);
      const s = randomScalar(CURVE_ORDER);
      const ct = elgamalEncrypt(authorityPublicKey, 1, r);
      const gate = computeXorGate(1, acc, authorityPublicKey, s);
      acc = computeXorAccumulator(ct, gate);
    }

    const decrypted = decrypt(acc, authorityPrivateKey);
    const G = EdwardsPoint.base();
    // 1 XOR 1 XOR 1 = 1
    expect(decrypted.x).toBe(G.x);
    expect(decrypted.y).toBe(G.y);
  });

  it("mixed XOR: 1 XOR 0 XOR 1 XOR 0 = 0", () => {
    const bits = [1, 0, 1, 0];
    let acc = identityCiphertext();

    for (const x of bits) {
      const r = randomScalar(CURVE_ORDER);
      const s = randomScalar(CURVE_ORDER);
      const ct = elgamalEncrypt(authorityPublicKey, x, r);
      const gate = computeXorGate(x, acc, authorityPublicKey, s);
      acc = computeXorAccumulator(ct, gate);
    }

    const decrypted = decrypt(acc, authorityPrivateKey);
    expect(decrypted.x).toBe(0n);
    expect(decrypted.y).toBe(1n);
  });

  it("mixed XOR: 1 XOR 0 XOR 1 XOR 1 = 1", () => {
    const bits = [1, 0, 1, 1];
    let acc = identityCiphertext();

    for (const x of bits) {
      const r = randomScalar(CURVE_ORDER);
      const s = randomScalar(CURVE_ORDER);
      const ct = elgamalEncrypt(authorityPublicKey, x, r);
      const gate = computeXorGate(x, acc, authorityPublicKey, s);
      acc = computeXorAccumulator(ct, gate);
    }

    const decrypted = decrypt(acc, authorityPrivateKey);
    const G = EdwardsPoint.base();
    expect(decrypted.x).toBe(G.x);
    expect(decrypted.y).toBe(G.y);
  });

  it("gate output points are on curve", () => {
    const acc = identityCiphertext();
    const r = randomScalar(CURVE_ORDER);
    const s = randomScalar(CURVE_ORDER);

    const gate = computeXorGate(1, acc, authorityPublicKey, s);
    expect(gate.c1.isOnCurve()).toBe(true);
    expect(gate.c2.isOnCurve()).toBe(true);
  });

  it("new accumulator points are on curve", () => {
    const acc = identityCiphertext();
    const r = randomScalar(CURVE_ORDER);
    const s = randomScalar(CURVE_ORDER);

    const ct = elgamalEncrypt(authorityPublicKey, 1, r);
    const gate = computeXorGate(1, acc, authorityPublicKey, s);
    const newAcc = computeXorAccumulator(ct, gate);

    expect(newAcc.c1.isOnCurve()).toBe(true);
    expect(newAcc.c2.isOnCurve()).toBe(true);
  });
});

describe("conditional negation matches circuit semantics", () => {
  it("x'=1 (x=1): no negation", () => {
    const p = EdwardsPoint.base();
    // In the circuit: x_prime * p.x = 1 * p.x = p.x
    // Result: (p.x, p.y) = p (unchanged)
    const result = new EdwardsPoint(p.x, p.y);
    expect(result.equals(p)).toBe(true);
  });

  it("x'=-1 (x=0): negation via field multiplication", () => {
    const p = EdwardsPoint.base();
    // In the circuit: x_prime * p.x = (-1) * p.x = FIELD_SIZE - p.x
    const negX = (FIELD_SIZE - p.x) % FIELD_SIZE;
    const result = new EdwardsPoint(negX, p.y);
    // This should equal -p
    const expected = negatePoint(p);
    expect(result.x).toBe(expected.x);
    expect(result.y).toBe(expected.y);
  });

  it("conditional negation on identity is identity for both x=0 and x=1", () => {
    const id = EdwardsPoint.identity(); // (0, 1)
    // x' * 0 = 0 for any x', so result is always (0, 1) = identity
    const negId = negatePoint(id);
    expect(negId.x).toBe(0n);
    expect(negId.y).toBe(1n);
  });
});
