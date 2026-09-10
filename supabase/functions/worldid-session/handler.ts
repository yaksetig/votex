// Request handling for the worldid-session function, extracted so it can be
// unit-tested with a fake supabase client (no live database).

import { errorResponse, jsonResponse, sha256Hex } from "../_shared/http.ts";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface CreateSessionRequest {
  action: "create";
  nullifierHash: string;
  verifierHash: string;
}

export interface ValidateSessionRequest {
  action: "validate";
  sessionToken: string;
}

export interface RevokeSessionRequest {
  action: "revoke";
  sessionToken: string;
}

export type SessionRequest =
  | CreateSessionRequest
  | ValidateSessionRequest
  | RevokeSessionRequest;

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function handleSessionRequest(
  supabase: SupabaseClient,
  body: SessionRequest
): Promise<Response> {
  if (body.action === "create") {
    if (!body.nullifierHash || !body.verifierHash) {
      return errorResponse(400, "VALIDATION_ERROR", "Missing nullifierHash or verifierHash");
    }

    const { data: binding, error: bindingError } = await supabase
      .from("world_id_keypairs")
      .select("nullifier_hash")
      .eq("nullifier_hash", body.nullifierHash)
      .maybeSingle();

    if (bindingError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load identity binding");
    }

    if (!binding) {
      return errorResponse(404, "NOT_FOUND", "Identity binding not found");
    }

    const { data: existingVerifier, error: verifierError } = await supabase
      .from("world_id_auth_verifiers")
      .select("verifier_hash")
      .eq("nullifier_hash", body.nullifierHash)
      .maybeSingle();

    if (verifierError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load verifier");
    }

    // Verifier registration happens exclusively in register-keypair under a
    // verified World ID proof. Issuing a session for an identity without a
    // verifier (the old trust-on-first-use bootstrap) would let anyone who
    // reads a public nullifier hash claim that identity.
    if (!existingVerifier) {
      return errorResponse(
        401,
        "VERIFIER_MISSING",
        "No verifier registered for this identity. Complete registration first."
      );
    }

    // The verifier is a static bearer credential, so only its SHA-256 is
    // stored (register-keypair writes it hashed; 20260909000100 backfilled
    // legacy rows). Compare hash-to-hash so a database read never yields a
    // value that can mint sessions.
    if (existingVerifier.verifier_hash !== (await sha256Hex(body.verifierHash))) {
      return errorResponse(401, "INVALID_SIGNATURE", "Passkey verifier mismatch");
    }

    const sessionToken = generateSessionToken();
    const tokenHash = await sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const { error: sessionError } = await supabase
      .from("world_id_sessions")
      .insert({
        expires_at: expiresAt,
        nullifier_hash: body.nullifierHash,
        token_hash: tokenHash,
      });

    if (sessionError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to create session");
    }

    return jsonResponse(200, {
      expiresAt,
      sessionToken,
      userId: body.nullifierHash,
    });
  }

  const tokenHash = await sha256Hex(body.sessionToken);

  const { data: session, error: sessionError } = await supabase
    .from("world_id_sessions")
    .select("expires_at, nullifier_hash, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError) {
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load session");
  }

  if (!session || session.revoked_at) {
    return jsonResponse(401, { valid: false });
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("world_id_sessions")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);

    return jsonResponse(401, { valid: false });
  }

  if (body.action === "validate") {
    await supabase
      .from("world_id_sessions")
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);

    return jsonResponse(200, {
      expiresAt: session.expires_at,
      userId: session.nullifier_hash,
      valid: true,
    });
  }

  if (body.action === "revoke") {
    const { error: revokeError } = await supabase
      .from("world_id_sessions")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);

    if (revokeError) {
      return errorResponse(500, "INTERNAL_ERROR", "Failed to revoke session");
    }

    return jsonResponse(200, { success: true });
  }

  return errorResponse(400, "VALIDATION_ERROR", "Unsupported action");
}
