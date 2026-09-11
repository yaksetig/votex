/**
 * The shared wire-protocol module is imported by both the browser and the
 * Deno edge functions. These vectors pin the formats every signature and
 * proof depends on; the Deno suites exercise the same file, so a change here
 * is a change on both sides by construction.
 */

import { describe, expect, it } from "vitest";
import {
  BABYJUB_BASE_POINT,
  BABYJUB_FIELD,
  BABYJUB_SUBGROUP_ORDER,
  addPoints,
  buildAuthorityLinkMessage,
  buildDelegationMessage,
  buildRegistrationOwnershipMessage,
  buildVoteMessage,
  checkProofFreshness,
  electionIdToField,
  hashMessageToField,
  hashPublicKeyForSignal,
  IDENTITY_POINT,
  isCanonicalDecimal,
  isInPrimeSubgroup,
  isOnCurve,
  multiplyPoint,
  negatePoint,
  parseCanonicalFieldElement,
  PROOF_MAX_AGE_MS,
  PROOF_MAX_FUTURE_SKEW_MS,
} from "@protocol";

const ELECTION = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const PK = { x: "11", y: "12" };

describe("signed message formats", () => {
  it("are versioned, domain-separated and colon-joined", () => {
    expect(buildVoteMessage(ELECTION, "Yes", 1700000000000)).toBe(`${ELECTION}:Yes:1700000000000`);
    expect(buildAuthorityLinkMessage("user-1", PK, "Authority", 5)).toBe(
      "votex:authority-link:v1:user-1:11:12:Authority:5"
    );
    expect(buildRegistrationOwnershipMessage("0xabc", PK, 5)).toBe("votex:register-keypair:v1:0xabc:11:12:5");
    expect(buildDelegationMessage("create", ELECTION, 5, { c1: PK, c2: { x: "13", y: "14" } })).toBe(
      `votex:delegation:v1:create:${ELECTION}:11:12:13:14:5`
    );
    expect(buildDelegationMessage("revoke", ELECTION, 5)).toBe(`votex:delegation:v1:revoke:${ELECTION}:5`);
    expect(() => buildDelegationMessage("create", ELECTION, 5)).toThrow();
  });
});

describe("electionIdToField", () => {
  it("encodes the UUID as a 128-bit decimal, case-insensitively", () => {
    expect(electionIdToField("00000000-0000-0000-0000-000000000001")).toBe("1");
    expect(electionIdToField("ffffffff-ffff-ffff-ffff-ffffffffffff")).toBe(((1n << 128n) - 1n).toString());
    expect(electionIdToField(ELECTION.toUpperCase())).toBe(electionIdToField(ELECTION));
  });

  it("rejects anything that is not a UUID", () => {
    expect(() => electionIdToField("not-a-uuid")).toThrow();
    expect(() => electionIdToField("3f2504e04f8911d39a0c0305e82c3301ff")).toThrow();
  });
});

describe("hashing conventions", () => {
  it("hashMessageToField is SHA-256 reduced into the subgroup order", async () => {
    const field = await hashMessageToField("votex");
    expect(field).toBeLessThan(BABYJUB_SUBGROUP_ORDER);
    // sha256("votex") mod q, computed independently with Node's crypto module.
    expect(field).toBe(1320930587760629904251520134015003171608859922103804303575150601952713103051n);
  });

  it("hashPublicKeyForSignal hashes 32-byte big-endian x||y and accepts bigint or string", async () => {
    const asBigint = await hashPublicKeyForSignal({ x: BABYJUB_BASE_POINT.x, y: BABYJUB_BASE_POINT.y });
    const asString = await hashPublicKeyForSignal({ x: BABYJUB_BASE_POINT.x.toString(), y: BABYJUB_BASE_POINT.y.toString() });
    expect(asBigint).toBe(asString);
    expect(asBigint).toMatch(/^0x[0-9a-f]{64}$/);
    // Pinned so the signal format cannot drift silently between runtimes.
    expect(asBigint).toBe("0xa6518fae63e7e0b67d40cf67bca21bd1b4d4e71e89e358cc259b7c423e22708a");
  });
});

describe("canonical decimal parsing", () => {
  it("accepts only unsigned, unpadded decimals below the field size", () => {
    expect(parseCanonicalFieldElement("0")).toBe(0n);
    expect(parseCanonicalFieldElement((BABYJUB_FIELD - 1n).toString())).toBe(BABYJUB_FIELD - 1n);
    for (const bad of [BABYJUB_FIELD.toString(), "-1", "007", "0x10", " 5", "5 ", "", 5, null]) {
      expect(parseCanonicalFieldElement(bad), String(bad)).toBeNull();
    }
    expect(isCanonicalDecimal("9".repeat(BABYJUB_FIELD.toString().length + 1))).toBe(false);
  });
});

describe("proof freshness", () => {
  it("accepts timestamps inside the window and classifies the rest", () => {
    const now = 1_800_000_000_000;
    expect(checkProofFreshness(now, now)).toBeNull();
    expect(checkProofFreshness(now - PROOF_MAX_AGE_MS, now)).toBeNull();
    expect(checkProofFreshness(now - PROOF_MAX_AGE_MS - 1, now)).toBe("EXPIRED");
    expect(checkProofFreshness(now + PROOF_MAX_FUTURE_SKEW_MS, now)).toBeNull();
    expect(checkProofFreshness(now + PROOF_MAX_FUTURE_SKEW_MS + 1, now)).toBe("FUTURE");
    expect(checkProofFreshness(1.5, now)).toBe("MALFORMED");
    expect(checkProofFreshness("123", now)).toBe("MALFORMED");
  });
});

describe("curve arithmetic", () => {
  it("the base point has prime order and the identity is neutral", () => {
    expect(isOnCurve(BABYJUB_BASE_POINT)).toBe(true);
    expect(isInPrimeSubgroup(BABYJUB_BASE_POINT)).toBe(true);
    expect(multiplyPoint(BABYJUB_BASE_POINT, BABYJUB_SUBGROUP_ORDER)).toEqual(IDENTITY_POINT);
    expect(addPoints(BABYJUB_BASE_POINT, IDENTITY_POINT)).toEqual(BABYJUB_BASE_POINT);
    expect(addPoints(BABYJUB_BASE_POINT, negatePoint(BABYJUB_BASE_POINT))).toEqual(IDENTITY_POINT);
  });

  it("scalar multiplication is a group homomorphism", () => {
    const twoG = addPoints(BABYJUB_BASE_POINT, BABYJUB_BASE_POINT);
    expect(multiplyPoint(BABYJUB_BASE_POINT, 2n)).toEqual(twoG);
    const fiveG = multiplyPoint(BABYJUB_BASE_POINT, 5n);
    expect(addPoints(multiplyPoint(BABYJUB_BASE_POINT, 3n), twoG)).toEqual(fiveG);
    expect(() => multiplyPoint(BABYJUB_BASE_POINT, -1n)).toThrow();
  });

  it("rejects points off the curve and outside the prime subgroup", () => {
    expect(isOnCurve({ x: 1n, y: 1n })).toBe(false);
    // (0, p-1) has order 2: on the curve but not in the prime subgroup.
    expect(isOnCurve({ x: 0n, y: BABYJUB_FIELD - 1n })).toBe(true);
    expect(isInPrimeSubgroup({ x: 0n, y: BABYJUB_FIELD - 1n })).toBe(false);
  });
});
