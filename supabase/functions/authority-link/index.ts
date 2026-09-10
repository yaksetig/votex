import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient, getAuthenticatedUser } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { verifyPoseidonSignature } from "../_shared/eddsa.ts";
import { isPlaceholderAuthorityKey, isUuid } from "../_shared/fixedAuthority.ts";
import { buildAuthorityLinkMessage, checkProofFreshness } from "../_shared/protocol.ts";

interface AuthorityLinkRequest {
  action?: "link";
  authorityName: string;
  issuedAt: number;
  publicKeyX: string;
  publicKeyY: string;
  signature: string;
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
      return errorResponse(401, "AUTHORITY_REQUIRED", "Missing authorization header");
    }

    const body = (await req.json()) as AuthorityLinkRequest;
    if (body.action && body.action !== "link") {
      return errorResponse(400, "VALIDATION_ERROR", "Unsupported action");
    }

    if (
      !body.authorityName?.trim() ||
      !body.publicKeyX ||
      !body.publicKeyY ||
      !body.signature ||
      !Number.isFinite(body.issuedAt)
    ) {
      return errorResponse(400, "VALIDATION_ERROR", "Missing authority link proof fields");
    }

    const freshness = checkProofFreshness(body.issuedAt);
    if (freshness === "FUTURE") {
      return errorResponse(400, "VALIDATION_ERROR", "Authority proof timestamp is in the future");
    }
    if (freshness) {
      return errorResponse(400, "VALIDATION_ERROR", "Authority proof has expired");
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return errorResponse(401, "AUTHORITY_REQUIRED", "Invalid authority session");
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
      return errorResponse(401, "AUTHORITY_REQUIRED", "Authority key ownership proof is invalid");
    }

    const supabase = createServiceRoleClient();

    const fixedAuthorityId = Deno.env.get("FIXED_AUTHORITY_ID")?.trim() ?? "";
    if (!isUuid(fixedAuthorityId)) {
      return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority is not configured");
    }

    const { data: existing, error: existingError } = await supabase
      .from("election_authorities")
      .select("id, name, auth_user_id, public_key_x, public_key_y")
      .eq("id", fixedAuthorityId)
      .maybeSingle();

    if (existingError) {
      console.error("Authority lookup error:", existingError);
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load authority record");
    }

    if (
      !existing ||
      isPlaceholderAuthorityKey({
        x: existing.public_key_x,
        y: existing.public_key_y,
      })
    ) {
      return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority is not ready");
    }

    if (
      existing.name !== authorityName ||
      existing.public_key_x !== publicKey.x ||
      existing.public_key_y !== publicKey.y
    ) {
      return errorResponse(403, "AUTHORITY_REQUIRED", "The supplied key does not belong to the fixed Election Authority");
    }

    if (existing.auth_user_id && existing.auth_user_id !== user.id) {
      return errorResponse(409, "CONFLICT", "The fixed Election Authority is already linked");
    }

    if (!existing.auth_user_id) {
      const { data: linked, error: updateError } = await supabase
        .from("election_authorities")
        .update({ auth_user_id: user.id })
        .eq("id", existing.id)
        .is("auth_user_id", null)
        .select("id");

      if (updateError) {
        console.error("Authority link update error:", updateError);
        return errorResponse(500, "INTERNAL_ERROR", "Failed to link the fixed Election Authority");
      }

      // Zero rows means another account won the race between our read and
      // this guarded update; reporting success here would be a lie.
      if (!Array.isArray(linked) || linked.length !== 1) {
        return errorResponse(409, "CONFLICT", "The fixed Election Authority was linked by another account");
      }
    }

    return jsonResponse(200, {
      authorityId: existing.id,
      authorityName: existing.name,
      success: true,
    });
  } catch (error) {
    console.error("authority-link error:", error);
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
  }
});
