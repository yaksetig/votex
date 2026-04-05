import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface CreateSessionRequest {
  action: "create";
  bootstrapVerifier?: boolean;
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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

      if (existingVerifier) {
        if (existingVerifier.verifier_hash !== body.verifierHash) {
          return jsonResponse(401, { error: "Passkey verifier mismatch" });
        }
      } else if (body.bootstrapVerifier) {
        const { error: insertVerifierError } = await supabase
          .from("world_id_auth_verifiers")
          .insert({
            nullifier_hash: body.nullifierHash,
            verifier_hash: body.verifierHash,
          });

        if (insertVerifierError) {
          return jsonResponse(500, { error: "Failed to store verifier" });
        }
      } else {
        return jsonResponse(401, { error: "No verifier registered" });
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
