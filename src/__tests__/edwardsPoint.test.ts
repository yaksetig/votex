import { describe, it, expect } from "vitest";
import { EdwardsPoint, derivePublicKey, verifyKeypairConsistency } from "../services/elGamalService";
import { CURVE_ORDER } from "../services/crypto/constants";

describe("EdwardsPoint", () => {
  it("identity point is on curve", () => {
    const id = EdwardsPoint.identity();
    expect(id.isOnCurve()).toBe(true);
  });

  it("base point is on curve", () => {
    const base = EdwardsPoint.base();
    expect(base.isOnCurve()).toBe(true);
  });

  it("identity + base = base", () => {
    const id = EdwardsPoint.identity();
    const base = EdwardsPoint.base();
    const result = id.add(base);
    expect(result.equals(base)).toBe(true);
  });

  it("base + identity = base", () => {
    const base = EdwardsPoint.base();
    const id = EdwardsPoint.identity();
    const result = base.add(id);
    expect(result.equals(base)).toBe(true);
  });

  it("scalar multiplication by 0 returns identity", () => {
    const base = EdwardsPoint.base();
    const result = base.multiply(0n);
    expect(result.equals(EdwardsPoint.identity())).toBe(true);
  });

  it("scalar multiplication by 1 returns the point itself", () => {
    const base = EdwardsPoint.base();
    const result = base.multiply(1n);
    expect(result.equals(base)).toBe(true);
  });

  it("2*G equals G+G", () => {
    const base = EdwardsPoint.base();
    const doubled = base.multiply(2n);
    const added = base.add(base);
    expect(doubled.equals(added)).toBe(true);
  });

  it("3*G equals G+G+G", () => {
    const base = EdwardsPoint.base();
    const tripled = base.multiply(3n);
    const added = base.add(base).add(base);
    expect(tripled.equals(added)).toBe(true);
  });

  it("scalar multiplication result is on curve", () => {
    const base = EdwardsPoint.base();
    const result = base.multiply(12345n);
    expect(result.isOnCurve()).toBe(true);
  });

  it("addition result is on curve", () => {
    const base = EdwardsPoint.base();
    const p1 = base.multiply(7n);
    const p2 = base.multiply(13n);
    const sum = p1.add(p2);
    expect(sum.isOnCurve()).toBe(true);
  });

  it("addition is commutative", () => {
    const base = EdwardsPoint.base();
    const p1 = base.multiply(42n);
    const p2 = base.multiply(99n);
    const sum1 = p1.add(p2);
    const sum2 = p2.add(p1);
    expect(sum1.equals(sum2)).toBe(true);
  });

  it("scalar multiplication is distributive: (a+b)*G = a*G + b*G", () => {
    const base = EdwardsPoint.base();
    const a = 17n;
    const b = 23n;
    const lhs = base.multiply(a + b);
    const rhs = base.multiply(a).add(base.multiply(b));
    expect(lhs.equals(rhs)).toBe(true);
  });

  it("order*G returns identity", () => {
    const base = EdwardsPoint.base();
    const result = base.multiply(CURVE_ORDER);
    expect(result.equals(EdwardsPoint.identity())).toBe(true);
  });

  it("equals returns false for different points", () => {
    const base = EdwardsPoint.base();
    const other = base.multiply(2n);
    expect(base.equals(other)).toBe(false);
  });
});

describe("derivePublicKey", () => {
  it("derives a valid on-curve public key", () => {
    const pk = derivePublicKey(42n);
    expect(pk.isOnCurve()).toBe(true);
  });

  it("derivation is deterministic", () => {
    const pk1 = derivePublicKey(12345n);
    const pk2 = derivePublicKey(12345n);
    expect(pk1.equals(pk2)).toBe(true);
  });

  it("different private keys give different public keys", () => {
    const pk1 = derivePublicKey(1n);
    const pk2 = derivePublicKey(2n);
    expect(pk1.equals(pk2)).toBe(false);
  });
});

describe("verifyKeypairConsistency", () => {
  it("returns true for a valid keypair", () => {
    const base = EdwardsPoint.base();
    const sk = 999n;
    const pk = base.multiply(sk);
    const keypair = {
      k: sk.toString(),
      Ax: pk.x.toString(),
      Ay: pk.y.toString(),
    };
    expect(verifyKeypairConsistency(keypair)).toBe(true);
  });

  it("returns false for a mismatched keypair", () => {
    const base = EdwardsPoint.base();
    const pk = base.multiply(999n);
    const keypair = {
      k: "123", // wrong private key
      Ax: pk.x.toString(),
      Ay: pk.y.toString(),
    };
    expect(verifyKeypairConsistency(keypair)).toBe(false);
  });
});
