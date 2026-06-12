// World ID session validation shared by every session-gated edge function.
// The session token is a bearer secret; only its SHA-256 hash is stored.

import { sha256Hex } from "./http.ts";

export interface SessionValidationResult {
  valid: boolean;
  detail?: string;
  userId?: string;
}

interface SessionClient {
  from(table: string): {
    // deno-lint-ignore no-explicit-any
    select(columns: string): any;
    // deno-lint-ignore no-explicit-any
    update(values: Record<string, unknown>): any;
  };
}

export async function validateWorldIdSession(
  supabase: SessionClient,
  sessionToken: string,
  options: { touchLastUsed?: boolean } = {}
): Promise<SessionValidationResult> {
  const tokenHash = await sha256Hex(sessionToken);
  const { data: session, error: sessionError } = await supabase
    .from("world_id_sessions")
    .select("expires_at, nullifier_hash, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError) {
    console.error("Session lookup error:", sessionError);
    return { valid: false, detail: "Failed to validate voter session" };
  }

  if (!session || session.revoked_at) {
    return { valid: false, detail: "Voter session is invalid or revoked" };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("world_id_sessions")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);

    return { valid: false, detail: "Voter session has expired" };
  }

  if (options.touchLastUsed) {
    await supabase
      .from("world_id_sessions")
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);
  }

  return { valid: true, userId: session.nullifier_hash };
}
