// Deno test: deno test --allow-env supabase/functions/worldid-session/handler.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleSessionRequest } from "./handler.ts";

// Fake supabase client returning canned rows per table. Each table maps to the
// row maybeSingle() should resolve to (or null). insert/update are no-ops.
function fakeClient(rows: Record<string, Record<string, unknown> | null>) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: rows[table] ?? null, error: null });
                },
              };
            },
          };
        },
        insert() {
          return Promise.resolve({ error: null });
        },
        update() {
          return { eq() { return Promise.resolve({ error: null }); } };
        },
      };
    },
  };
}

Deno.test("create: identity without a verifier is rejected (H3 regression)", async () => {
  const client = fakeClient({
    world_id_keypairs: { nullifier_hash: "0xabc" },
    world_id_auth_verifiers: null, // no verifier registered
  });

  const res = await handleSessionRequest(client, {
    action: "create",
    nullifierHash: "0xabc",
    verifierHash: "attacker-verifier",
  });

  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.code, "VERIFIER_MISSING");
});

Deno.test("create: unknown identity binding is 404", async () => {
  const client = fakeClient({ world_id_keypairs: null });
  const res = await handleSessionRequest(client, {
    action: "create",
    nullifierHash: "0xunknown",
    verifierHash: "v",
  });
  assertEquals(res.status, 404);
});

Deno.test("create: verifier mismatch is rejected", async () => {
  const client = fakeClient({
    world_id_keypairs: { nullifier_hash: "0xabc" },
    world_id_auth_verifiers: { verifier_hash: "real-verifier" },
  });
  const res = await handleSessionRequest(client, {
    action: "create",
    nullifierHash: "0xabc",
    verifierHash: "wrong-verifier",
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Passkey verifier mismatch");
});

Deno.test("create: matching verifier issues a session token", async () => {
  const client = fakeClient({
    world_id_keypairs: { nullifier_hash: "0xabc" },
    world_id_auth_verifiers: { verifier_hash: "real-verifier" },
  });
  const res = await handleSessionRequest(client, {
    action: "create",
    nullifierHash: "0xabc",
    verifierHash: "real-verifier",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.userId, "0xabc");
  assertEquals(typeof body.sessionToken, "string");
});
