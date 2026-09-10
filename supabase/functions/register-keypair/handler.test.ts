// Deno test: deno test --allow-env supabase/functions/register-keypair/handler.test.ts
//
// Exercises the registration binding logic with a fake World ID verifier and
// a fake supabase client, using a real circomlibjs keypair so the proof of
// possession is genuinely checked.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sha256Hex } from "../_shared/http.ts";
import {
  buildRegistrationOwnershipMessage,
  hashPublicKeyForSignal,
} from "../_shared/protocol.ts";
import { makeTestKeypair, signTestMessage, type TestKeypair } from "../_shared/testing.ts";
import {
  handleRegisterKeypair,
  interpretWorldIdVerifyResponse,
  type IDKitResult,
  type RegisterKeypairRequest,
  type WorldIdVerification,
} from "./handler.ts";

const NULLIFIER = "0x" + "ab".repeat(32);
const OTHER_NULLIFIER = "0x" + "cd".repeat(32);
const VERIFIER = "11".repeat(32);

const fakeSignalHash = (signal: string) => `sh:${signal}`;

async function buildRequest(
  keypair: TestKeypair,
  overrides: Partial<RegisterKeypairRequest> = {},
  proofOverrides: { nullifier?: string; issuedAt?: number; signer?: TestKeypair } = {}
): Promise<RegisterKeypairRequest> {
  const signal = await hashPublicKeyForSignal(keypair.pk);
  const issuedAt = proofOverrides.issuedAt ?? Date.now();
  const nullifier = proofOverrides.nullifier ?? NULLIFIER;
  const signer = proofOverrides.signer ?? keypair;
  const idkitResult: IDKitResult = {
    protocol_version: "4.0",
    nonce: "nonce",
    action: "registration",
    environment: "production",
    responses: [{ identifier: "orb", signal_hash: fakeSignalHash(signal), proof: ["1"], nullifier: NULLIFIER }],
  };
  return {
    pk: keypair.pk,
    signal,
    verifierHash: VERIFIER,
    idkitResult,
    ownershipProof: {
      issuedAt,
      signature: await signTestMessage(signer.seed, buildRegistrationOwnershipMessage(nullifier, keypair.pk, issuedAt)),
    },
    ...overrides,
  };
}

interface FakeDb {
  existing: Record<string, unknown> | null;
  inserts: Record<string, unknown>[];
  upserts: Record<string, unknown>[];
  insertError?: { code: string };
}

function fakeClient(db: FakeDb) {
  return {
    from(table: string) {
      return {
        select() {
          return { eq() { return { maybeSingle() { return Promise.resolve({ data: db.existing, error: null }); } }; } };
        },
        insert(row: Record<string, unknown>) {
          db.inserts.push({ table, ...row });
          return Promise.resolve({ error: db.insertError ?? null });
        },
        upsert(row: Record<string, unknown>) {
          db.upserts.push({ table, ...row });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

function deps(db: FakeDb, verification: WorldIdVerification = { valid: true, nullifier: NULLIFIER }) {
  const calls: IDKitResult[] = [];
  return {
    calls,
    deps: {
      supabase: fakeClient(db),
      computeSignalHash: fakeSignalHash,
      verifyWorldIdProof: (r: IDKitResult) => { calls.push(r); return Promise.resolve(verification); },
    },
  };
}

Deno.test("interpret: HTTP 200 without success/results is not a verification", () => {
  assertEquals(interpretWorldIdVerifyResponse(true, null).valid, false);
  assertEquals(interpretWorldIdVerifyResponse(true, { success: false }).valid, false);
  assertEquals(interpretWorldIdVerifyResponse(true, { success: true }).valid, false);
  assertEquals(
    interpretWorldIdVerifyResponse(true, { success: true, results: [{ success: false, nullifier: NULLIFIER }] }).valid,
    false
  );
  assertEquals(
    interpretWorldIdVerifyResponse(true, {
      success: true,
      results: [{ success: true, nullifier: NULLIFIER }, { success: true, nullifier: OTHER_NULLIFIER }],
    }).valid,
    false
  );
  assertEquals(interpretWorldIdVerifyResponse(true, { success: true, action: "other", results: [{ success: true, nullifier: NULLIFIER }] }).valid, false);
});

Deno.test("interpret: a single successful result yields the API nullifier", () => {
  const result = interpretWorldIdVerifyResponse(true, { success: true, action: "registration", results: [{ success: true, nullifier: NULLIFIER }] });
  assertEquals(result, { valid: true, nullifier: NULLIFIER });
});

Deno.test("register: happy path stores the key, a hashed verifier, and pins action/environment", async () => {
  const keypair = await makeTestKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const { deps: d, calls } = deps(db);

  const res = await handleRegisterKeypair(d, await buildRequest(keypair));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).alreadyExists, false);
  assertEquals(db.inserts[0], { table: "world_id_keypairs", nullifier_hash: NULLIFIER, public_key_x: keypair.pk.x, public_key_y: keypair.pk.y });
  assertEquals(db.upserts[0], { table: "world_id_auth_verifiers", nullifier_hash: NULLIFIER, verifier_hash: await sha256Hex(VERIFIER) });
  assertEquals(calls[0].action, "registration");
  assertEquals(calls[0].environment, "production");
});

Deno.test("register: caller-supplied action/environment are not forwarded", async () => {
  const keypair = await makeTestKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const { deps: d, calls } = deps(db);
  const req = await buildRequest(keypair);
  req.idkitResult.environment = "staging";
  const res = await handleRegisterKeypair(d, req);
  assertEquals(res.status, 200);
  assertEquals(calls[0].environment, "production");

  req.idkitResult.action = "registration-2";
  assertEquals((await handleRegisterKeypair(d, req)).status, 400);
});

Deno.test("register: API nullifier mismatch and failed verification are rejected", async () => {
  const keypair = await makeTestKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const mismatch = deps(db, { valid: true, nullifier: OTHER_NULLIFIER });
  assertEquals((await handleRegisterKeypair(mismatch.deps, await buildRequest(keypair))).status, 400);
  const failed = deps(db, { valid: false, detail: "nope" });
  assertEquals((await handleRegisterKeypair(failed.deps, await buildRequest(keypair))).status, 400);
  assertEquals(db.inserts.length, 0);
});

Deno.test("register: two IDKit responses are rejected before any network call", async () => {
  const keypair = await makeTestKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const { deps: d, calls } = deps(db);
  const req = await buildRequest(keypair);
  req.idkitResult.responses.push({ ...req.idkitResult.responses[0], nullifier: OTHER_NULLIFIER });
  assertEquals((await handleRegisterKeypair(d, req)).status, 400);
  assertEquals(calls.length, 0);
});

Deno.test("register: ownership proof must be signed by the submitted key for this nullifier", async () => {
  const victim = await makeTestKeypair(7);
  const attacker = await makeTestKeypair(9);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const { deps: d } = deps(db);

  // Attacker holds a valid World ID proof but signs with their own key.
  const wrongSigner = await buildRequest(victim, {}, { signer: attacker });
  assertEquals((await handleRegisterKeypair(d, wrongSigner)).status, 400);

  // Proof signed for a different nullifier.
  const wrongNullifier = await buildRequest(victim, {}, { nullifier: OTHER_NULLIFIER });
  assertEquals((await handleRegisterKeypair(d, wrongNullifier)).status, 400);

  // Stale proof.
  const stale = await buildRequest(victim, {}, { issuedAt: Date.now() - 10 * 60 * 1000 });
  assertEquals((await handleRegisterKeypair(d, stale)).status, 400);

  // Missing proof.
  const missing = await buildRequest(victim, { ownershipProof: undefined as unknown as RegisterKeypairRequest["ownershipProof"] });
  assertEquals((await handleRegisterKeypair(d, missing)).status, 400);
  assertEquals(db.inserts.length, 0);
  assertEquals(db.upserts.length, 0);
});

Deno.test("register: non-canonical public key and malformed verifier are rejected", async () => {
  const keypair = await makeTestKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const { deps: d } = deps(db);
  const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const aliased = { x: (BigInt(keypair.pk.x) + p).toString(), y: keypair.pk.y };
  assertEquals((await handleRegisterKeypair(d, await buildRequest({ ...keypair, pk: aliased }))).status, 400);
  assertEquals((await handleRegisterKeypair(d, await buildRequest(keypair, { verifierHash: "short" }))).status, 400);
});

Deno.test("register: same key re-registration refreshes the hashed verifier; different key is 409", async () => {
  const keypair = await makeTestKeypair(7);
  const same: FakeDb = { existing: { id: "1", public_key_x: keypair.pk.x, public_key_y: keypair.pk.y }, inserts: [], upserts: [] };
  const res = await handleRegisterKeypair(deps(same).deps, await buildRequest(keypair));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).alreadyExists, true);
  assertEquals(same.upserts[0].verifier_hash, await sha256Hex(VERIFIER));

  const other = await makeTestKeypair(9);
  const diff: FakeDb = { existing: { id: "1", public_key_x: other.pk.x, public_key_y: other.pk.y }, inserts: [], upserts: [] };
  const conflict = await handleRegisterKeypair(deps(diff).deps, await buildRequest(keypair));
  assertEquals(conflict.status, 409);
  assertEquals((await conflict.json()).code, "KEYPAIR_ALREADY_BOUND");
});

Deno.test("register: unique-violation on the public key surfaces as 409", async () => {
  const keypair = await makeTestKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [], insertError: { code: "23505" } };
  const res = await handleRegisterKeypair(deps(db).deps, await buildRequest(keypair));
  assertEquals(res.status, 409);
  assertEquals((await res.json()).code, "PUBLIC_KEY_ALREADY_BOUND");
});
