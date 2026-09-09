// Deno test: deno test --allow-env supabase/functions/register-keypair/handler.test.ts
//
// Exercises the registration binding logic with a fake World ID verifier and
// a fake supabase client, using a real circomlibjs keypair so the proof of
// possession is genuinely checked.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
// @ts-expect-error: circomlibjs ships no accurate type definitions
import { buildEddsa } from "npm:circomlibjs@0.1.7";
import { sha256Hex } from "../_shared/http.ts";
import {
  buildOwnershipProofMessage,
  handleRegisterKeypair,
  interpretWorldIdVerifyResponse,
  type IDKitResult,
  type RegisterKeypairRequest,
  type WorldIdVerification,
} from "./handler.ts";

const CURVE_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const NULLIFIER = "0x" + "ab".repeat(32);
const OTHER_NULLIFIER = "0x" + "cd".repeat(32);
const VERIFIER = "11".repeat(32);

async function hashMessageToField(message: string): Promise<bigint> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  const hex = Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, "0")).join("");
  return BigInt(`0x${hex}`) % CURVE_ORDER;
}

async function hashPublicKeyForSignal(pk: { x: string; y: string }): Promise<string> {
  const bytes = new Uint8Array(64);
  let x = BigInt(pk.x);
  for (let i = 31; i >= 0; i--) { bytes[i] = Number(x & 0xffn); x >>= 8n; }
  let y = BigInt(pk.y);
  for (let i = 63; i >= 32; i--) { bytes[i] = Number(y & 0xffn); y >>= 8n; }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return "0x" + Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Keypair {
  seed: Uint8Array;
  pk: { x: string; y: string };
}

async function makeKeypair(fill: number): Promise<Keypair> {
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

const fakeSignalHash = (signal: string) => `sh:${signal}`;

async function buildRequest(
  keypair: Keypair,
  overrides: Partial<RegisterKeypairRequest> = {},
  proofOverrides: { nullifier?: string; issuedAt?: number; signer?: Keypair } = {}
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
      signature: await sign(signer.seed, buildOwnershipProofMessage(nullifier, keypair.pk, issuedAt)),
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
  const keypair = await makeKeypair(7);
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
  const keypair = await makeKeypair(7);
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
  const keypair = await makeKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const mismatch = deps(db, { valid: true, nullifier: OTHER_NULLIFIER });
  assertEquals((await handleRegisterKeypair(mismatch.deps, await buildRequest(keypair))).status, 400);
  const failed = deps(db, { valid: false, detail: "nope" });
  assertEquals((await handleRegisterKeypair(failed.deps, await buildRequest(keypair))).status, 400);
  assertEquals(db.inserts.length, 0);
});

Deno.test("register: two IDKit responses are rejected before any network call", async () => {
  const keypair = await makeKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const { deps: d, calls } = deps(db);
  const req = await buildRequest(keypair);
  req.idkitResult.responses.push({ ...req.idkitResult.responses[0], nullifier: OTHER_NULLIFIER });
  assertEquals((await handleRegisterKeypair(d, req)).status, 400);
  assertEquals(calls.length, 0);
});

Deno.test("register: ownership proof must be signed by the submitted key for this nullifier", async () => {
  const victim = await makeKeypair(7);
  const attacker = await makeKeypair(9);
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
  const keypair = await makeKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [] };
  const { deps: d } = deps(db);
  const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const aliased = { x: (BigInt(keypair.pk.x) + p).toString(), y: keypair.pk.y };
  assertEquals((await handleRegisterKeypair(d, await buildRequest({ ...keypair, pk: aliased }))).status, 400);
  assertEquals((await handleRegisterKeypair(d, await buildRequest(keypair, { verifierHash: "short" }))).status, 400);
});

Deno.test("register: same key re-registration refreshes the hashed verifier; different key is 409", async () => {
  const keypair = await makeKeypair(7);
  const same: FakeDb = { existing: { id: "1", public_key_x: keypair.pk.x, public_key_y: keypair.pk.y }, inserts: [], upserts: [] };
  const res = await handleRegisterKeypair(deps(same).deps, await buildRequest(keypair));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).alreadyExists, true);
  assertEquals(same.upserts[0].verifier_hash, await sha256Hex(VERIFIER));

  const other = await makeKeypair(9);
  const diff: FakeDb = { existing: { id: "1", public_key_x: other.pk.x, public_key_y: other.pk.y }, inserts: [], upserts: [] };
  const conflict = await handleRegisterKeypair(deps(diff).deps, await buildRequest(keypair));
  assertEquals(conflict.status, 409);
  assertEquals((await conflict.json()).code, "KEYPAIR_ALREADY_BOUND");
});

Deno.test("register: unique-violation on the public key surfaces as 409", async () => {
  const keypair = await makeKeypair(7);
  const db: FakeDb = { existing: null, inserts: [], upserts: [], insertError: { code: "23505" } };
  const res = await handleRegisterKeypair(deps(db).deps, await buildRequest(keypair));
  assertEquals(res.status, 409);
  assertEquals((await res.json()).code, "PUBLIC_KEY_ALREADY_BOUND");
});
