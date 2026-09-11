/**
 * Browser-side nullification helpers that carry security weight but need no
 * network: the k-anonymity slot shuffle, the write-result code mapping, and
 * the local ElGamal decryption used by the tally.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { secureShuffle } from "../lib/secureShuffle";
import { normalizeWriteCode } from "../lib/nullificationWriteResult";
import { decryptElGamalInExponent, ensureDiscreteLogTable } from "../services/elGamalTallyService";
import { EdwardsPoint, elgamalEncrypt } from "../services/elGamalService";

describe("secureShuffle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a permutation and leaves the input untouched", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = secureShuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...output].sort((a, b) => a - b)).toEqual(input);
    expect(secureShuffle([])).toEqual([]);
    expect(secureShuffle(["only"])).toEqual(["only"]);
  });

  it("draws indices without modulo bias: values at or above the rejection limit are redrawn", () => {
    // For a range of 3 the largest multiple of 3 below 2^32 is 4294967295, so
    // 4294967295 must be rejected and 4294967294 (= 2 mod 3) accepted.
    const draws = [4294967295, 4294967294, 0, 0];
    const spy = vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: Uint32Array) => {
      array[0] = draws.shift() ?? 0;
      return array;
    }) as typeof crypto.getRandomValues);
    const output = secureShuffle(["a", "b", "c"]);
    expect(spy).toHaveBeenCalledTimes(3); // one rejection + two accepted draws
    // i=2: j = 4294967294 % 3 = 2 (no swap); i=1: j = 0 (swap b and a)
    expect(output).toEqual(["b", "a", "c"]);
  });

  it("places the first element at every position over many runs", () => {
    const seen = new Set<number>();
    for (let run = 0; run < 200 && seen.size < 6; run++) {
      seen.add(secureShuffle([0, 1, 2, 3, 4, 5]).indexOf(0));
    }
    expect(seen.size).toBe(6);
  });
});

describe("normalizeWriteCode", () => {
  it("passes through the codes the page branches on and collapses everything else", () => {
    expect(normalizeWriteCode("ACCUMULATOR_CONFLICT")).toBe("ACCUMULATOR_CONFLICT");
    expect(normalizeWriteCode("RATE_LIMITED")).toBe("RATE_LIMITED");
    expect(normalizeWriteCode("ELECTION_CLOSED")).toBe("ELECTION_CLOSED");
    expect(normalizeWriteCode("INTERNAL_ERROR")).toBe("UNKNOWN");
    expect(normalizeWriteCode(undefined)).toBe("UNKNOWN");
    expect(normalizeWriteCode(42)).toBe("UNKNOWN");
  });
});

describe("decryptElGamalInExponent", () => {
  const sk = 424242n;
  const pk = EdwardsPoint.base().multiply(sk);

  it("recovers small plaintexts and extends the memo on demand", async () => {
    await ensureDiscreteLogTable(2);
    expect(await decryptElGamalInExponent(elgamalEncrypt(pk, 0), sk)).toBe(0);
    expect(await decryptElGamalInExponent(elgamalEncrypt(pk, 1), sk)).toBe(1);
    // 9 is beyond the table; the memo grows and the value becomes decodable.
    expect(await decryptElGamalInExponent(elgamalEncrypt(pk, 9), sk)).toBeNull();
    await ensureDiscreteLogTable(10);
    expect(await decryptElGamalInExponent(elgamalEncrypt(pk, 9), sk)).toBe(9);
  });

  it("returns null under the wrong key instead of a wrong number", async () => {
    await ensureDiscreteLogTable(10);
    expect(await decryptElGamalInExponent(elgamalEncrypt(pk, 1), sk + 1n)).toBeNull();
  });
});
