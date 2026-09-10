// Deno test: deno test --allow-env supabase/functions/nullification-write/handler.test.ts
//
// The Groth16 verifier is injected: these tests cover everything the server
// does AROUND the proof (batch shape, submitter binding, election and key
// binding, accumulator continuity, persistence mapping). Proof soundness
// itself is covered by src/__tests__/circuitNegative.test.ts against the
// real artifacts.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sha256Hex } from "../_shared/http.ts";
import {
  computeAccumulatorUpdate,
  electionIdToField,
  identityCiphertextJson,
  type NullificationProofPayload,
  type ParsedNullificationSignals,
} from "../_shared/nullification.ts";
import { fakeSupabase, type FakeSupabaseOptions } from "../_shared/testing.ts";
import { handleNullificationWrite, MAX_BATCH_SIZE, type SubmitNullificationBatchRequest } from "./handler.ts";

const ELECTION = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const OTHER_ELECTION = "00000000-0000-0000-0000-000000000009";
const AUTHORITY_ID = "11111111-1111-1111-1111-111111111111";
const AUTHORITY_PK = { x: "5", y: "6" };
const SUBMITTER = "0x" + "aa".repeat(32);
const DECOY = "0x" + "bb".repeat(32);
const OUTSIDER = "0x" + "cc".repeat(32);
const TOKEN = "session-token";
const NOW = 1_800_000_000_000;
const KEYS: Record<string, { x: string; y: string }> = {
  [SUBMITTER]: { x: "101", y: "102" },
  [DECOY]: { x: "201", y: "202" },
};

// The fake verifier treats the "proof" as a carrier for pre-parsed signals so
// each test can describe exactly what a verified proof claims.
type FakeProof = NullificationProofPayload & { parsed: ParsedNullificationSignals | null };

function proofFor(target: string, overrides: Partial<ParsedNullificationSignals> = {}, valid = true): FakeProof {
  const parsed: ParsedNullificationSignals = {
    ciphertext: { c1: { x: "1", y: "2" }, c2: { x: "3", y: "4" } },
    gateOutput: { c1: { x: "0", y: "1" }, c2: { x: "0", y: "1" } },
    accumulator: identityCiphertextJson(),
    voterPublicKey: KEYS[target] ?? { x: "0", y: "1" },
    authorityPublicKey: AUTHORITY_PK,
    electionId: electionIdToField(ELECTION),
    ...overrides,
  };
  return {
    proof: { pi_a: ["1", "2", "1"], pi_b: [["1", "2"], ["3", "4"], ["1", "0"]], pi_c: ["1", "2", "1"], protocol: "groth16", curve: "bn128" },
    publicSignals: [],
    parsed: valid ? parsed : null,
  };
}

const verifyProof = (payload: NullificationProofPayload) => Promise.resolve((payload as FakeProof).parsed);

async function world(options: Partial<FakeSupabaseOptions> = {}) {
  return fakeSupabase({
    tables: {
      world_id_sessions: [{ token_hash: await sha256Hex(TOKEN), nullifier_hash: SUBMITTER, expires_at: new Date(NOW + 60_000).toISOString(), revoked_at: null }],
      elections: [{ id: ELECTION, authority_id: AUTHORITY_ID, end_date: new Date(NOW + 86_400_000).toISOString(), closed_manually_at: null }],
      election_authorities: [{ id: AUTHORITY_ID, public_key_x: AUTHORITY_PK.x, public_key_y: AUTHORITY_PK.y }],
      election_participants: [
        { election_id: ELECTION, participant_id: SUBMITTER, public_key_x: KEYS[SUBMITTER].x, public_key_y: KEYS[SUBMITTER].y },
        { election_id: ELECTION, participant_id: DECOY, public_key_x: KEYS[DECOY].x, public_key_y: KEYS[DECOY].y },
      ],
      nullification_accumulators: [],
    },
    ...options,
  });
}

function batch(items: Array<{ userId: string; accumulatorVersion?: number; zkp?: FakeProof }>): SubmitNullificationBatchRequest {
  return {
    electionId: ELECTION,
    sessionToken: TOKEN,
    nullifications: items.map((item) => ({
      userId: item.userId,
      accumulatorVersion: item.accumulatorVersion ?? 0,
      zkp: item.zkp ?? proofFor(item.userId),
    })),
  };
}

const deps = (fake: { client: unknown }) => ({ supabase: fake.client, verifyProof, now: () => NOW });

async function expectCode(res: Response, status: number, code: string) {
  assertEquals(res.status, status);
  assertEquals((await res.json()).code, code);
}

Deno.test("batch: a valid two-slot batch is persisted with server-computed accumulators", async () => {
  const fake = await world();
  const res = await handleNullificationWrite(deps(fake), batch([{ userId: DECOY }, { userId: SUBMITTER }]));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).processedRows, 2);
  assertEquals(fake.rpcCalls.length, 1);
  const args = fake.rpcCalls[0].args as { p_submitter_id: string; p_items: Array<{ userId: string; newAccumulator: unknown; currentAccumulator: unknown }> };
  assertEquals(args.p_submitter_id, SUBMITTER);
  assertEquals(args.p_items.map((i) => i.userId), [DECOY, SUBMITTER]);
  assertEquals(args.p_items[0].currentAccumulator, identityCiphertextJson());
  assertEquals(args.p_items[0].newAccumulator, computeAccumulatorUpdate(proofFor(DECOY).parsed!));
});

Deno.test("batch: shape rules — size bounds, duplicate targets, missing submitter slot", async () => {
  const fake = await world();
  await expectCode(await handleNullificationWrite(deps(fake), batch([])), 400, "VALIDATION_ERROR");
  const tooMany = batch(Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => ({ userId: `0x${i}` })));
  await expectCode(await handleNullificationWrite(deps(fake), tooMany), 400, "VALIDATION_ERROR");
  await expectCode(await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER }, { userId: SUBMITTER }])), 400, "VALIDATION_ERROR");
  await expectCode(await handleNullificationWrite(deps(fake), batch([{ userId: DECOY }])), 400, "VALIDATION_ERROR");
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("batch: session, election state and participant membership are enforced", async () => {
  const fake = await world();
  const noSession = batch([{ userId: SUBMITTER }]);
  noSession.sessionToken = "wrong";
  await expectCode(await handleNullificationWrite(deps(fake), noSession), 401, "SESSION_REQUIRED");

  const closedWorld = fakeSupabase({
    tables: {
      world_id_sessions: [{ token_hash: await sha256Hex(TOKEN), nullifier_hash: SUBMITTER, expires_at: new Date(NOW + 60_000).toISOString(), revoked_at: null }],
      elections: [{ id: ELECTION, authority_id: AUTHORITY_ID, end_date: new Date(NOW - 1).toISOString(), closed_manually_at: null }],
    },
  });
  await expectCode(await handleNullificationWrite(deps(closedWorld), batch([{ userId: SUBMITTER }])), 409, "ELECTION_CLOSED");

  await expectCode(await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER }, { userId: OUTSIDER }])), 400, "VALIDATION_ERROR");
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("batch: every proof must verify and bind to election, authority and target key", async () => {
  const fake = await world();
  await expectCode(
    await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER, zkp: proofFor(SUBMITTER, {}, false) }])),
    400,
    "INVALID_PROOF"
  );
  // A proof from another election (cross-election replay) is rejected.
  await expectCode(
    await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER, zkp: proofFor(SUBMITTER, { electionId: electionIdToField(OTHER_ELECTION) }) }])),
    400,
    "VALIDATION_ERROR"
  );
  await expectCode(
    await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER, zkp: proofFor(SUBMITTER, { authorityPublicKey: { x: "9", y: "9" } }) }])),
    400,
    "VALIDATION_ERROR"
  );
  // A proof for the decoy's key submitted against the submitter's slot.
  await expectCode(
    await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER, zkp: proofFor(DECOY) }])),
    400,
    "VALIDATION_ERROR"
  );
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("batch: accumulator continuity — version and stored state must match the proof", async () => {
  const stored = { c1: { x: "7", y: "8" }, c2: { x: "9", y: "10" } };
  const fake = fakeSupabase({
    tables: {
      world_id_sessions: [{ token_hash: await sha256Hex(TOKEN), nullifier_hash: SUBMITTER, expires_at: new Date(NOW + 60_000).toISOString(), revoked_at: null }],
      elections: [{ id: ELECTION, authority_id: AUTHORITY_ID, end_date: new Date(NOW + 86_400_000).toISOString(), closed_manually_at: null }],
      election_authorities: [{ id: AUTHORITY_ID, public_key_x: AUTHORITY_PK.x, public_key_y: AUTHORITY_PK.y }],
      election_participants: [{ election_id: ELECTION, participant_id: SUBMITTER, public_key_x: KEYS[SUBMITTER].x, public_key_y: KEYS[SUBMITTER].y }],
      nullification_accumulators: [{ election_id: ELECTION, voter_id: SUBMITTER, acc_c1_x: "7", acc_c1_y: "8", acc_c2_x: "9", acc_c2_y: "10", version: 3 }],
    },
  });

  // Stale version.
  await expectCode(
    await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER, accumulatorVersion: 2, zkp: proofFor(SUBMITTER, { accumulator: stored }) }])),
    409,
    "ACCUMULATOR_CONFLICT"
  );
  // Right version, but the proof was made against a different accumulator.
  await expectCode(
    await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER, accumulatorVersion: 3 }])),
    409,
    "ACCUMULATOR_CONFLICT"
  );
  // Both match.
  const ok = await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER, accumulatorVersion: 3, zkp: proofFor(SUBMITTER, { accumulator: stored }) }]));
  assertEquals(ok.status, 200);
});

Deno.test("batch: RPC failures map to codes", async () => {
  for (const [message, status, code] of [
    ["RATE_LIMITED", 429, "RATE_LIMITED"],
    ["ELECTION_CLOSED", 409, "ELECTION_CLOSED"],
    ["Accumulator version mismatch for voter x", 409, "ACCUMULATOR_CONFLICT"],
    ["Target user x is not a participant in this election", 400, "VALIDATION_ERROR"],
    ["something else", 500, "INTERNAL_ERROR"],
  ] as const) {
    const fake = await world({ rpc: () => ({ error: { message } }) });
    await expectCode(await handleNullificationWrite(deps(fake), batch([{ userId: SUBMITTER }])), status, code);
  }
});
