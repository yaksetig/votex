// Deno test: deno test supabase/functions/_shared/session.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateWorldIdSession } from "./session.ts";

// Minimal fake of the supabase query builder chain used by the validator.
// Records update() calls so tests can assert the expiry-revocation side effect.
function fakeClient(sessionRow: Record<string, unknown> | null, opts: { error?: boolean } = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from(_table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve(
                    opts.error
                      ? { data: null, error: new Error("db down") }
                      : { data: sessionRow, error: null }
                  );
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          updates.push(values);
          return { eq() { return Promise.resolve({ error: null }); } };
        },
      };
    },
  };
  return { client, updates };
}

const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

Deno.test("valid session returns the nullifier as userId", async () => {
  const { client } = fakeClient({
    expires_at: future(),
    nullifier_hash: "0xabc",
    revoked_at: null,
  });
  const result = await validateWorldIdSession(client, "token");
  assertEquals(result.valid, true);
  assertEquals(result.userId, "0xabc");
});

Deno.test("missing session is invalid", async () => {
  const { client } = fakeClient(null);
  const result = await validateWorldIdSession(client, "token");
  assertEquals(result.valid, false);
});

Deno.test("revoked session is invalid", async () => {
  const { client } = fakeClient({
    expires_at: future(),
    nullifier_hash: "0xabc",
    revoked_at: new Date().toISOString(),
  });
  const result = await validateWorldIdSession(client, "token");
  assertEquals(result.valid, false);
});

Deno.test("expired session is invalid and gets revoked", async () => {
  const { client, updates } = fakeClient({
    expires_at: past(),
    nullifier_hash: "0xabc",
    revoked_at: null,
  });
  const result = await validateWorldIdSession(client, "token");
  assertEquals(result.valid, false);
  // Expiry path writes a revoked_at timestamp.
  assertEquals(updates.length, 1);
  assertEquals(typeof updates[0].revoked_at, "string");
});

Deno.test("lookup error is invalid", async () => {
  const { client } = fakeClient(null, { error: true });
  const result = await validateWorldIdSession(client, "token");
  assertEquals(result.valid, false);
});

Deno.test("touchLastUsed updates last_used_at on a valid session", async () => {
  const { client, updates } = fakeClient({
    expires_at: future(),
    nullifier_hash: "0xabc",
    revoked_at: null,
  });
  const result = await validateWorldIdSession(client, "token", { touchLastUsed: true });
  assertEquals(result.valid, true);
  assertEquals(updates.length, 1);
  assertEquals(typeof updates[0].last_used_at, "string");
});
