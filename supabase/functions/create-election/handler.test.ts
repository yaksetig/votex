// Deno test: deno test --allow-env supabase/functions/create-election/handler.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sha256Hex } from "../_shared/http.ts";
import { fakeSupabase, type FakeSupabaseOptions } from "../_shared/testing.ts";
import { handleCreateElection, type CreateElectionRequest } from "./handler.ts";

const AUTHORITY = "8b1d3c42-9e5a-4c3e-8f0d-1a2b3c4d5e6f";
const VOTER = "0x" + "cd".repeat(32);
const TOKEN = "session-token";
const NOW = 1_800_000_000_000;
const IDEMPOTENCY = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

async function world(overrides: Partial<FakeSupabaseOptions> = {}) {
  const fake = fakeSupabase({
    tables: {
      world_id_sessions: [{
        token_hash: await sha256Hex(TOKEN),
        nullifier_hash: VOTER,
        expires_at: new Date(NOW + 60_000).toISOString(),
        revoked_at: null,
      }],
      election_authorities: [{
        id: AUTHORITY,
        auth_user_id: "auth-user",
        public_key_x: "1234",
        public_key_y: "5678",
      }],
    },
    rpc: (_name, args) => ({ data: { id: "election-1", ...args } }),
    ...overrides,
  });
  return fake;
}

function request(overrides: Partial<CreateElectionRequest> = {}): Partial<CreateElectionRequest> {
  return {
    sessionToken: TOKEN,
    title: "Community budget",
    description: "Should the surplus fund the irrigation project?",
    option1: "Approve",
    option2: "Decline",
    endDate: new Date(NOW + 86_400_000).toISOString(),
    idempotencyKey: IDEMPOTENCY,
    ...overrides,
  };
}

Deno.test("creates an election with the running tally shown by default", async () => {
  const fake = await world();
  const response = await handleCreateElection({ supabase: fake.client, fixedAuthorityId: AUTHORITY, now: () => NOW }, request());
  assertEquals(response.status, 200);
  assertEquals(fake.rpcCalls.length, 1);
  assertEquals(fake.rpcCalls[0].name, "create_election_atomic");
  assertEquals(fake.rpcCalls[0].args.p_show_running_tally, true);
  assertEquals(fake.rpcCalls[0].args.p_creator, VOTER);
});

Deno.test("passes an explicit showRunningTally=false through to the database", async () => {
  const fake = await world();
  const response = await handleCreateElection(
    { supabase: fake.client, fixedAuthorityId: AUTHORITY, now: () => NOW },
    request({ showRunningTally: false })
  );
  assertEquals(response.status, 200);
  assertEquals(fake.rpcCalls[0].args.p_show_running_tally, false);
});

Deno.test("rejects a non-boolean showRunningTally", async () => {
  const fake = await world();
  const response = await handleCreateElection(
    { supabase: fake.client, fixedAuthorityId: AUTHORITY, now: () => NOW },
    request({ showRunningTally: "yes" as unknown as boolean })
  );
  assertEquals(response.status, 400);
  assertEquals((await response.json()).code, "VALIDATION_ERROR");
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("rejects identical options and past deadlines before touching the database", async () => {
  const fake = await world();
  const sameOptions = await handleCreateElection(
    { supabase: fake.client, fixedAuthorityId: AUTHORITY, now: () => NOW },
    request({ option1: "Yes", option2: " yes " })
  );
  assertEquals(sameOptions.status, 400);
  const pastDeadline = await handleCreateElection(
    { supabase: fake.client, fixedAuthorityId: AUTHORITY, now: () => NOW },
    request({ endDate: new Date(NOW - 1).toISOString() })
  );
  assertEquals(pastDeadline.status, 400);
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test("requires a valid session and a configured authority", async () => {
  const fake = await world();
  const noSession = await handleCreateElection(
    { supabase: fake.client, fixedAuthorityId: AUTHORITY, now: () => NOW },
    request({ sessionToken: "" })
  );
  assertEquals(noSession.status, 401);
  assertEquals((await noSession.json()).code, "SESSION_REQUIRED");

  const noAuthority = await handleCreateElection(
    { supabase: fake.client, fixedAuthorityId: undefined, now: () => NOW },
    request()
  );
  assertEquals(noAuthority.status, 503);
  assertEquals((await noAuthority.json()).code, "FIXED_AUTHORITY_UNAVAILABLE");
});
