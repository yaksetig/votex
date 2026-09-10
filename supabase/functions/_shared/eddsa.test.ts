// Deno test: deno test --allow-env supabase/functions/_shared/eddsa.test.ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyPoseidonSignature } from "./eddsa.ts";
import { BABYJUB_FIELD, BABYJUB_SUBGROUP_ORDER } from "./protocol.ts";
import { makeTestKeypair, signTestMessage } from "./testing.ts";

const MESSAGE = "votex:edge-verifier:test";

Deno.test("pinned edge verifier accepts a signature in the browser's serialised format", async () => {
  const signer = await makeTestKeypair(7);
  const signature = await signTestMessage(signer.seed, MESSAGE);
  assertEquals(await verifyPoseidonSignature(signature, signer.pk, MESSAGE), true);
});

Deno.test("edge verifier rejects wrong message, wrong key, out-of-range S, identity R8", async () => {
  const signer = await makeTestKeypair(7);
  const other = await makeTestKeypair(8);
  const payload = JSON.parse(await signTestMessage(signer.seed, MESSAGE));
  const withPatch = (patch: Record<string, unknown>) => JSON.stringify({ ...payload, ...patch });

  assertEquals(await verifyPoseidonSignature(withPatch({}), signer.pk, MESSAGE + "x"), false);
  assertEquals(await verifyPoseidonSignature(withPatch({}), other.pk, MESSAGE), false);
  assertEquals(await verifyPoseidonSignature(withPatch({ S: BABYJUB_SUBGROUP_ORDER.toString() }), signer.pk, MESSAGE), false);
  assertEquals(await verifyPoseidonSignature(withPatch({ R8: { x: "0", y: "1" } }), signer.pk, MESSAGE), false);
});

Deno.test("edge verifier rejects non-canonical encodings of otherwise valid values", async () => {
  const signer = await makeTestKeypair(7);
  const payload = JSON.parse(await signTestMessage(signer.seed, MESSAGE));
  const withPatch = (patch: Record<string, unknown>) => JSON.stringify({ ...payload, ...patch });

  const aliasedR8 = { x: (BigInt(payload.R8.x) + BABYJUB_FIELD).toString(), y: payload.R8.y };
  assertEquals(await verifyPoseidonSignature(withPatch({ R8: aliasedR8 }), signer.pk, MESSAGE), false);
  const aliasedKey = { x: (BigInt(signer.pk.x) + BABYJUB_FIELD).toString(), y: signer.pk.y };
  assertEquals(await verifyPoseidonSignature(withPatch({}), aliasedKey, MESSAGE), false);
  assertEquals(await verifyPoseidonSignature(withPatch({ S: `0${payload.S}` }), signer.pk, MESSAGE), false);
  assertEquals(await verifyPoseidonSignature(withPatch({ S: "0x10" }), signer.pk, MESSAGE), false);
});

Deno.test("edge verifier throws on a malformed payload rather than returning true", async () => {
  const signer = await makeTestKeypair(7);
  await assertRejects(() => verifyPoseidonSignature("{}", signer.pk, MESSAGE));
  await assertRejects(() => verifyPoseidonSignature("not json", signer.pk, MESSAGE));
});
