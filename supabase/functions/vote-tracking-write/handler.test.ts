// Deno test: deno test --allow-env supabase/functions/vote-tracking-write/handler.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sha256Hex } from "../_shared/http.ts";
import { buildVoteMessage } from "../_shared/protocol.ts";
import { fakeSupabase, makeTestKeypair, signTestMessage, type FakeSupabaseOptions } from "../_shared/testing.ts";
import { handleVoteWrite, MAX_SIGNATURE_LENGTH, VOTE_TIMESTAMP_SKEW_MS, type VoteWriteRequest } from "./handler.ts";

const ELECTION = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const VOTER = "0x" + "ab".repeat(32);
const TOKEN = "session-token";
const NOW = 1_800_000_000_000;

async function world(overrides: Partial<FakeSupabaseOptions> = {}, electionOverrides: Record<string, unknown> = {}) {
  const voter = await makeTestKeypair(5);
  const fake = fakeSupabase({
    tables: {
      world_id_sessions: [{
        token_hash: await sha256Hex(TOKEN),
        nullifier_hash: VOTER,
        expires_at: new Date(NOW + 60_000).toISOString(),
        revoked_at: null,
      }],
      elections: [{
        id: ELECTION,
        title: "Test",
        option1: "Yes",
        option2: "No",
        end_date: new Date(NOW + 86_400_000).toISOString(),
        closed_manually_at: null,
        ...electionOverrides,
      }],
      election_participants: [{ election_id: ELECTION, participant_id: VOTER, public_key_x: voter.pk.x, public_key_y: voter.pk.y }],
    },
    rpc: () => ({
      data: [{
        receipt_id: "r1",
        already_existed: false,
        recorded_choice: "Yes",
        recorded_signature: "sig",
        recorded_timestamp: NOW,
        accepted_at: new Date(NOW).toISOString(),
      }],
    }),
    ...overrides,
  });
  return { voter, fake };
}

async function signedRequest(voter: { seed: Uint8Array }, overrides: Partial<VoteWriteRequest> = {}): Promise<VoteWriteRequest> {
  const timestamp = overrides.timestamp ?? NOW;
  const choice = overrides.choice ?? "Yes";
  return {
    electionId: ELECTION,
    sessionToken: TOKEN,
    choice,
    timestamp,
    signature: await signTestMessage(voter.seed, buildVoteMessage(ELECTION, choice, timestamp)),
    ...overrides,
  };
}

const deps = (fake: { client: unknown }) => ({ supabase: fake.client, now: () => NOW });

Deno.test("cast-vote: a fresh, correctly signed ballot is recorded through cast_vote_atomic", async () => {
  const { voter, fake } = await world();
  const res = await handleVoteWrite(deps(fake), await signedRequest(voter));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.receipt.voterPseudonym, VOTER);
  assertEquals(body.receipt.signatureVerified, true);
  assertEquals(fake.rpcCalls.length, 1);
  assertEquals(fake.rpcCalls[0].args.p_voter, VOTER);
  assertEquals(fake.rpcCalls[0].args.p_choice, "Yes");
});

Deno.test("cast-vote: shape limits are enforced before any lookup", async () => {
  const { voter, fake } = await world();
  const cases: Array<Partial<VoteWriteRequest>> = [
    { signature: "x".repeat(MAX_SIGNATURE_LENGTH + 1) },
    { choice: "" },
    { timestamp: 1.5 },
    { timestamp: Number.MAX_SAFE_INTEGER + 2 },
    { idempotencyKey: "not-a-uuid" },
    { action: "other" as unknown as "cast-vote" },
  ];
  for (const override of cases) {
    const res = await handleVoteWrite(deps(fake), { ...(await signedRequest(voter)), ...override });
    assertEquals(res.status, 400, JSON.stringify(override));
    assertEquals((await res.json()).code, "VALIDATION_ERROR");
  }
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("cast-vote: unknown session, closed election, foreign choice, stale timestamp", async () => {
  const { voter, fake } = await world();
  const badToken = await handleVoteWrite(deps(fake), await signedRequest(voter, { sessionToken: "nope" }));
  assertEquals(badToken.status, 401);

  const closed = await world({}, { closed_manually_at: new Date(NOW - 1).toISOString() });
  const closedRes = await handleVoteWrite(deps(closed.fake), await signedRequest(closed.voter));
  assertEquals(closedRes.status, 409);
  assertEquals((await closedRes.json()).code, "ELECTION_CLOSED");

  const wrongChoice = await handleVoteWrite(deps(fake), await signedRequest(voter, { choice: "Maybe" }));
  assertEquals((await wrongChoice.json()).code, "INVALID_CHOICE");

  const stale = await handleVoteWrite(deps(fake), await signedRequest(voter, { timestamp: NOW - VOTE_TIMESTAMP_SKEW_MS - 1 }));
  assertEquals((await stale.json()).code, "INVALID_SIGNATURE");
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("cast-vote: the signature must come from the key registered for this voter", async () => {
  const { voter, fake } = await world();
  const impostor = await makeTestKeypair(6);
  const forged = await handleVoteWrite(deps(fake), await signedRequest(impostor));
  assertEquals(forged.status, 401);
  assertEquals((await forged.json()).code, "INVALID_SIGNATURE");

  // A valid signature over a different choice cannot be replayed for this one.
  const swapped = await signedRequest(voter, { choice: "No" });
  swapped.choice = "Yes";
  const replay = await handleVoteWrite(deps(fake), swapped);
  assertEquals((await replay.json()).code, "INVALID_SIGNATURE");
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("cast-vote: an unregistered voter is refused and RPC failures map to codes", async () => {
  const { voter } = await world();
  const unregistered = fakeSupabase({
    tables: {
      world_id_sessions: [{ token_hash: await sha256Hex(TOKEN), nullifier_hash: VOTER, expires_at: new Date(NOW + 60_000).toISOString(), revoked_at: null }],
      elections: [{ id: ELECTION, title: "T", option1: "Yes", option2: "No", end_date: new Date(NOW + 1000).toISOString(), closed_manually_at: null }],
      election_participants: [],
    },
  });
  const res = await handleVoteWrite({ supabase: unregistered.client, now: () => NOW }, await signedRequest(voter));
  assertEquals(res.status, 409);
  assertEquals((await res.json()).code, "PARTICIPANT_REQUIRED");

  const rpcClosed = await world({ rpc: () => ({ error: { message: "ELECTION_CLOSED" } }) });
  const closedRes = await handleVoteWrite(deps(rpcClosed.fake), await signedRequest(rpcClosed.voter));
  assertEquals(closedRes.status, 409);
  assertEquals((await closedRes.json()).code, "ELECTION_CLOSED");
});
