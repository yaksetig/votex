import { describe, it, expect } from "vitest";
import { mod, modInverse, toBytesBE, randomScalar } from "../services/crypto/utils";
import { CURVE_ORDER, FIELD_SIZE } from "../services/crypto/constants";

describe("mod", () => {
  it("handles positive values", () => {
    expect(mod(10n, 3n)).toBe(1n);
  });

  it("handles negative values", () => {
    expect(mod(-1n, 5n)).toBe(4n);
  });

  it("returns 0 for exact multiples", () => {
    expect(mod(6n, 3n)).toBe(0n);
  });
});

describe("modInverse", () => {
  it("a * modInverse(a, m) === 1 mod m", () => {
    const a = 7n;
    const m = 11n;
    const inv = modInverse(a, m);
    expect(inv).not.toBeNull();
    expect((a * inv!) % m).toBe(1n);
  });

  it("returns null when inverse does not exist", () => {
    // gcd(6, 9) = 3 != 1
    expect(modInverse(6n, 9n)).toBeNull();
  });

  it("works for large field elements", () => {
    const a = 123456789n;
    const inv = modInverse(a, FIELD_SIZE);
    expect(inv).not.toBeNull();
    expect((a * inv!) % FIELD_SIZE).toBe(1n);
  });
});

describe("toBytesBE", () => {
  it("converts 0 to 32 zero bytes", () => {
    const bytes = toBytesBE(0n);
    expect(bytes.length).toBe(32);
    expect(bytes.every((b) => b === 0)).toBe(true);
  });

  it("converts 1 to bytes with last byte = 1", () => {
    const bytes = toBytesBE(1n);
    expect(bytes[31]).toBe(1);
    expect(bytes.slice(0, 31).every((b) => b === 0)).toBe(true);
  });

  it("converts 256 correctly", () => {
    const bytes = toBytesBE(256n);
    expect(bytes[30]).toBe(1);
    expect(bytes[31]).toBe(0);
  });
});

describe("randomScalar", () => {
  it("generates a value less than the order", () => {
    const scalar = randomScalar(CURVE_ORDER);
    expect(scalar >= 0n).toBe(true);
    expect(scalar < CURVE_ORDER).toBe(true);
  });

  it("generates different values on successive calls", () => {
    const a = randomScalar(CURVE_ORDER);
    const b = randomScalar(CURVE_ORDER);
    // Extremely unlikely to collide in a 254-bit space
    expect(a).not.toBe(b);
  });
});
