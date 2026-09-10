// Deno test: deno test --allow-env supabase/functions/_shared/delegation.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyDelegationAuthorization } from "./delegation.ts";
import { buildDelegationMessage } from "./protocol.ts";
import { makeTestKeypair, signTestMessage } from "./testing.ts";

const ELECTION = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const CT = { c1: { x: "11", y: "12" }, c2: { x: "13", y: "14" } };

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
  const voter = await makeTestKeypair(3);
  const now = Date.now();
  const create = {
    issuedAt: now,
    signature: await signTestMessage(voter.seed, buildDelegationMessage("create", ELECTION, now, CT)),
  };
  assertEquals(await verifyDelegationAuthorization(create, voter.pk, "create", ELECTION, CT, now), null);
  const revoke = {
    issuedAt: now,
    signature: await signTestMessage(voter.seed, buildDelegationMessage("revoke", ELECTION, now)),
  };
  assertEquals(await verifyDelegationAuthorization(revoke, voter.pk, "revoke", ELECTION, undefined, now), null);
});

Deno.test("signatures by another key, for another action/election/ciphertext, stale, or missing are rejected", async () => {
  const voter = await makeTestKeypair(3);
  const other = await makeTestKeypair(4);
  const now = Date.now();
  const message = buildDelegationMessage("create", ELECTION, now, CT);
  const verify = (auth: { issuedAt: number; signature: string } | undefined, action: "create" | "revoke", election = ELECTION, ct: typeof CT | undefined = CT, at = now) =>
    verifyDelegationAuthorization(auth, voter.pk, action, election, action === "create" ? ct : undefined, at);

  const wrongKey = { issuedAt: now, signature: await signTestMessage(other.seed, message) };
  assertEquals(await verify(wrongKey, "create"), "INVALID_SIGNATURE");

  const good = { issuedAt: now, signature: await signTestMessage(voter.seed, message) };
  assertEquals(await verify(good, "revoke"), "INVALID_SIGNATURE");
  assertEquals(await verify(good, "create", "00000000-0000-0000-0000-000000000000"), "INVALID_SIGNATURE");
  assertEquals(await verify(good, "create", ELECTION, { ...CT, c2: { x: "99", y: "98" } }), "INVALID_SIGNATURE");

  assertEquals(await verify(good, "create", ELECTION, CT, now + 10 * 60 * 1000), "EXPIRED");
  assertEquals(await verify(good, "create", ELECTION, CT, now - 10 * 60 * 1000), "FUTURE");
  assertEquals(await verify(undefined, "create"), "MALFORMED");
  assertEquals(await verify({ issuedAt: now, signature: "not json" }, "create"), "INVALID_SIGNATURE");
});
