// Deno test: deno test --allow-env supabase/functions/_shared/delegation.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
// @ts-expect-error: circomlibjs ships no accurate type definitions
import { buildEddsa } from "npm:circomlibjs@0.1.7";
import {
  buildDelegationMessage,
  verifyDelegationAuthorization,
} from "./delegation.ts";

const CURVE_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const ELECTION = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const CT = { c1: { x: "11", y: "12" }, c2: { x: "13", y: "14" } };

async function hashMessageToField(message: string): Promise<bigint> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  const hex = Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, "0")).join("");
  return BigInt(`0x${hex}`) % CURVE_ORDER;
}

async function keypair(fill: number) {
  const eddsa = await buildEddsa();
  const seed = new Uint8Array(32).fill(fill);
  const point = eddsa.prv2pub(seed);
  return {
    seed,
    pk: {
      x: BigInt(eddsa.F.toObject(point[0])).toString(),
      y: BigInt(eddsa.F.toObject(point[1])).toString(),
    },
  };
}

async function sign(seed: Uint8Array, message: string): Promise<string> {
  const eddsa = await buildEddsa();
  const signature = eddsa.signPoseidon(seed, eddsa.F.e(await hashMessageToField(message)));
  return JSON.stringify({
    R8: {
      x: BigInt(eddsa.F.toObject(signature.R8[0])).toString(),
      y: BigInt(eddsa.F.toObject(signature.R8[1])).toString(),
    },
    S: signature.S.toString(),
    message,
  });
}

Deno.test("delegation message format binds action, election, ciphertext and time", () => {
  assertEquals(
    buildDelegationMessage("create", ELECTION, 1700000000000, CT),
    `votex:delegation:v1:create:${ELECTION}:11:12:13:14:1700000000000`
  );
  assertEquals(
    buildDelegationMessage("revoke", ELECTION, 1700000000000),
    `votex:delegation:v1:revoke:${ELECTION}:1700000000000`
  );
});

Deno.test("a fresh signature by the delegator's key is accepted for create and revoke", async () => {
  const voter = await keypair(3);
  const now = Date.now();
  const create = { issuedAt: now, signature: await sign(voter.seed, buildDelegationMessage("create", ELECTION, now, CT)) };
  assertEquals(await verifyDelegationAuthorization(create, voter.pk, "create", ELECTION, CT, now), null);
  const revoke = { issuedAt: now, signature: await sign(voter.seed, buildDelegationMessage("revoke", ELECTION, now)) };
  assertEquals(await verifyDelegationAuthorization(revoke, voter.pk, "revoke", ELECTION, undefined, now), null);
});

Deno.test("signatures by another key, for another action/election/ciphertext, stale, or missing are rejected", async () => {
  const voter = await keypair(3);
  const other = await keypair(4);
  const now = Date.now();
  const message = buildDelegationMessage("create", ELECTION, now, CT);

  const wrongKey = { issuedAt: now, signature: await sign(other.seed, message) };
  assertEquals(await verifyDelegationAuthorization(wrongKey, voter.pk, "create", ELECTION, CT, now), "INVALID_SIGNATURE");

  const good = { issuedAt: now, signature: await sign(voter.seed, message) };
  assertEquals(await verifyDelegationAuthorization(good, voter.pk, "revoke", ELECTION, undefined, now), "INVALID_SIGNATURE");
  assertEquals(await verifyDelegationAuthorization(good, voter.pk, "create", "00000000-0000-0000-0000-000000000000", CT, now), "INVALID_SIGNATURE");
  const otherCt = { ...CT, c2: { x: "99", y: "98" } };
  assertEquals(await verifyDelegationAuthorization(good, voter.pk, "create", ELECTION, otherCt, now), "INVALID_SIGNATURE");

  assertEquals(await verifyDelegationAuthorization(good, voter.pk, "create", ELECTION, CT, now + 10 * 60 * 1000), "EXPIRED");
  assertEquals(await verifyDelegationAuthorization(good, voter.pk, "create", ELECTION, CT, now - 10 * 60 * 1000), "FUTURE");
  assertEquals(await verifyDelegationAuthorization(undefined, voter.pk, "create", ELECTION, CT, now), "MALFORMED");
  assertEquals(await verifyDelegationAuthorization({ issuedAt: now, signature: "not json" }, voter.pk, "create", ELECTION, CT, now), "INVALID_SIGNATURE");
});
