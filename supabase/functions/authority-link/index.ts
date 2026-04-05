import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPoseidonSignature } from "../_shared/eddsa.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_AUTHORITY_NAME = "Default Election Authority";
const MAX_PROOF_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

interface AuthorityLinkRequest {
  action?: "link";
  authorityName: string;
  issuedAt: number;
  publicKeyX: string;
  publicKeyY: string;
  signature: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function buildAuthorityLinkMessage(
  authUserId: string,
  publicKey: { x: string; y: string },
  authorityName: string,
  issuedAt: number
): string {
  return [
    "votex:authority-link:v1",
    authUserId,
    publicKey.x,
    publicKey.y,
    authorityName,
    issuedAt.toString(),
  ].join(":");
}

async function verifyAuthorityOwnershipProof(
  authUserId: string,
  authorityName: string,
  publicKey: { x: string; y: string },
  issuedAt: number,
  signature: string
): Promise<boolean> {
  const expectedMessage = buildAuthorityLinkMessage(
    authUserId,
    publicKey,
    authorityName,
    issuedAt
  );
  return verifyPoseidonSignature(signature, publicKey, expectedMessage);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization header" });
    }

    const body = (await req.json()) as AuthorityLinkRequest;
    if (body.action && body.action !== "link") {
      return jsonResponse(400, { error: "Unsupported action" });
    }

    if (
      !body.authorityName?.trim() ||
      !body.publicKeyX ||
      !body.publicKeyY ||
      !body.signature ||
      !Number.isFinite(body.issuedAt)
    ) {
      return jsonResponse(400, { error: "Missing authority link proof fields" });
    }

    const now = Date.now();
    if (body.issuedAt > now + MAX_FUTURE_SKEW_MS) {
      return jsonResponse(400, { error: "Authority proof timestamp is in the future" });
    }

    if (now - body.issuedAt > MAX_PROOF_AGE_MS) {
      return jsonResponse(400, { error: "Authority proof has expired" });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("Authority auth lookup error:", userError);
      return jsonResponse(401, { error: "Invalid authority session" });
    }

    const authorityName = body.authorityName.trim();
    const publicKey = {
      x: body.publicKeyX,
      y: body.publicKeyY,
    };

    const proofValid = await verifyAuthorityOwnershipProof(
      user.id,
      authorityName,
      publicKey,
      body.issuedAt,
      body.signature
    );

    if (!proofValid) {
      return jsonResponse(401, { error: "Authority key ownership proof is invalid" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing, error: existingError } = await supabase
      .from("election_authorities")
      .select("id, name, auth_user_id")
      .eq("public_key_x", publicKey.x)
      .eq("public_key_y", publicKey.y)
      .maybeSingle();

    if (existingError) {
      console.error("Authority lookup error:", existingError);
      return jsonResponse(500, { error: "Failed to load authority record" });
    }

    if (existing) {
      if (existing.name === DEFAULT_AUTHORITY_NAME && existing.auth_user_id !== user.id) {
        return jsonResponse(403, {
          error:
            "The default election authority must be linked through a server-side bootstrap, not self-service signup.",
        });
      }

      if (existing.auth_user_id && existing.auth_user_id !== user.id) {
        return jsonResponse(409, { error: "This authority is already linked to another account" });
      }

      if (!existing.auth_user_id) {
        const { error: updateError } = await supabase
          .from("election_authorities")
          .update({ auth_user_id: user.id })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Authority link update error:", updateError);
          return jsonResponse(500, { error: "Failed to link authority to this account" });
        }
      }

      return jsonResponse(200, {
        authorityId: existing.id,
        authorityName: existing.name,
        success: true,
      });
    }

    const { data: created, error: insertError } = await supabase
      .from("election_authorities")
      .insert({
        auth_user_id: user.id,
        description: null,
        name: authorityName,
        public_key_x: publicKey.x,
        public_key_y: publicKey.y,
      })
      .select("id, name")
      .single();

    if (insertError || !created) {
      console.error("Authority create error:", insertError);
      return jsonResponse(500, { error: "Failed to create authority record" });
    }

    return jsonResponse(200, {
      authorityId: created.id,
      authorityName: created.name,
      success: true,
    });
  } catch (error) {
    console.error("authority-link error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
