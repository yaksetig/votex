import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, sha256Hex } from "../_shared/http.ts";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface CreateSessionRequest {
  action: "create";
  nullifierHash: string;
  verifierHash: string;
}

interface ValidateSessionRequest {
  action: "validate";
  sessionToken: string;
}

interface RevokeSessionRequest {
  action: "revoke";
  sessionToken: string;
}

type SessionRequest =
  | CreateSessionRequest
  | ValidateSessionRequest
  | RevokeSessionRequest;

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = (await req.json()) as SessionRequest;

    if (body.action === "create") {
      if (!body.nullifierHash || !body.verifierHash) {
        return jsonResponse(400, {
          error: "Missing nullifierHash or verifierHash",
        });
      }

      const { data: binding, error: bindingError } = await supabase
        .from("world_id_keypairs")
        .select("nullifier_hash")
        .eq("nullifier_hash", body.nullifierHash)
        .maybeSingle();

      if (bindingError) {
        return jsonResponse(500, { error: "Failed to load identity binding" });
      }

      if (!binding) {
        return jsonResponse(404, { error: "Identity binding not found" });
      }

      const { data: existingVerifier, error: verifierError } = await supabase
        .from("world_id_auth_verifiers")
        .select("verifier_hash")
        .eq("nullifier_hash", body.nullifierHash)
        .maybeSingle();

      if (verifierError) {
        return jsonResponse(500, { error: "Failed to load verifier" });
      }

      // Verifier registration happens exclusively in register-keypair under a
      // verified World ID proof. Issuing a session for an identity without a
      // verifier (the old trust-on-first-use bootstrap) would let anyone who
      // reads a public nullifier hash claim that identity.
      if (!existingVerifier) {
        return jsonResponse(401, {
          error:
            "No verifier registered for this identity. Complete registration first.",
          code: "VERIFIER_MISSING",
        });
      }

      if (existingVerifier.verifier_hash !== body.verifierHash) {
        return jsonResponse(401, { error: "Passkey verifier mismatch" });
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
        return jsonResponse(500, { error: "Failed to create session" });
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
      return jsonResponse(500, { error: "Failed to load session" });
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
      await supabase
        .from("world_id_sessions")
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq("token_hash", tokenHash);

      return jsonResponse(200, { success: true });
    }

    return jsonResponse(400, { error: "Unsupported action" });
  } catch (error) {
    console.error("worldid-session error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
