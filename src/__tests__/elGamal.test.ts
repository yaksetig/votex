import { describe, it, expect } from "vitest";
import {
  EdwardsPoint,
  elgamalEncrypt,
  ElGamalCiphertext,
} from "../services/elGamalService";

describe("ElGamal encryption", () => {
  const authoritySecret = 42n;
  const authorityPk = EdwardsPoint.base().multiply(authoritySecret);

  it("ciphertext points are on curve", () => {
    const ct = elgamalEncrypt(authorityPk, 1);
    expect(ct.c1.isOnCurve()).toBe(true);
    expect(ct.c2.isOnCurve()).toBe(true);
  });

  it("encrypting with known r is deterministic", () => {
    const r = 12345n;
    const ct1 = elgamalEncrypt(authorityPk, 1, r);
    const ct2 = elgamalEncrypt(authorityPk, 1, r);
    expect(ct1.c1.equals(ct2.c1)).toBe(true);
    expect(ct1.c2.equals(ct2.c2)).toBe(true);
  });

  it("different randomness produces different ciphertexts", () => {
    const ct1 = elgamalEncrypt(authorityPk, 1, 111n);
    const ct2 = elgamalEncrypt(authorityPk, 1, 222n);
    expect(ct1.c1.equals(ct2.c1)).toBe(false);
  });

  it("decrypt message=0 correctly (c2 - sk*c1 = identity)", () => {
    const r = 777n;
    const ct = elgamalEncrypt(authorityPk, 0, r);

    // Decrypt: m*G = c2 - sk*c1
    const skTimesC1 = ct.c1.multiply(authoritySecret);
    // Negate: in Edwards curves, -(x,y) = (-x,y)
    const neg = new EdwardsPoint(-skTimesC1.x, skTimesC1.y);
    const decrypted = ct.c2.add(neg);

    expect(decrypted.equals(EdwardsPoint.identity())).toBe(true);
  });

  it("decrypt message=1 correctly (c2 - sk*c1 = G)", () => {
    const r = 777n;
    const ct = elgamalEncrypt(authorityPk, 1, r);

    const skTimesC1 = ct.c1.multiply(authoritySecret);
    const neg = new EdwardsPoint(-skTimesC1.x, skTimesC1.y);
    const decrypted = ct.c2.add(neg);

    expect(decrypted.equals(EdwardsPoint.base())).toBe(true);
  });

  it("homomorphic addition: Enc(1) + Enc(1) decrypts to 2*G", () => {
    const r1 = 100n;
    const r2 = 200n;
    const ct1 = elgamalEncrypt(authorityPk, 1, r1);
    const ct2 = elgamalEncrypt(authorityPk, 1, r2);

    // Homomorphic addition
    const sumC1 = ct1.c1.add(ct2.c1);
    const sumC2 = ct1.c2.add(ct2.c2);

    // Decrypt the sum
    const skTimesC1 = sumC1.multiply(authoritySecret);
    const neg = new EdwardsPoint(-skTimesC1.x, skTimesC1.y);
    const decrypted = sumC2.add(neg);

    const twoG = EdwardsPoint.base().multiply(2n);
    expect(decrypted.equals(twoG)).toBe(true);
  });

  it("ciphertext tuple matches c1/c2 coordinates", () => {
    const ct = elgamalEncrypt(authorityPk, 1, 55n);
    expect(ct.ciphertext[0]).toBe(ct.c1.x);
    expect(ct.ciphertext[1]).toBe(ct.c1.y);
    expect(ct.ciphertext[2]).toBe(ct.c2.x);
    expect(ct.ciphertext[3]).toBe(ct.c2.y);
  });
});
