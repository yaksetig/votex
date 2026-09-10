// Creates an election for a server-validated World ID session and always binds
// it to the single configured Election Authority. The client cannot choose the
// creator or authority identifiers.

import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import { isPlaceholderAuthorityKey, isUuid } from "../_shared/fixedAuthority.ts";

const MAX_REQUEST_BYTES = 16_384;

interface CreateElectionRequest {
  sessionToken: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  endDate: string;
  idempotencyKey: string;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST is supported");
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", "Election request is too large");
  }

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return errorResponse(413, "PAYLOAD_TOO_LARGE", "Election request is too large");
    }

    let body: Partial<CreateElectionRequest>;
    try {
      body = JSON.parse(rawBody) as Partial<CreateElectionRequest>;
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "Request body must be valid JSON");
    }
    const title = cleanText(body.title);
    const description = cleanText(body.description);
    const option1 = cleanText(body.option1);
    const option2 = cleanText(body.option2);
    const sessionToken = cleanText(body.sessionToken);
    const idempotencyKey = cleanText(body.idempotencyKey);
    const endDate = new Date(cleanText(body.endDate));

    if (!sessionToken) {
      return errorResponse(401, "SESSION_REQUIRED", "A World ID session is required");
    }

    if (
      title.length < 3 || title.length > 100 ||
      description.length < 10 || description.length > 500 ||
      option1.length < 1 || option1.length > 50 ||
      option2.length < 1 || option2.length > 50 ||
      option1.toLocaleLowerCase() === option2.toLocaleLowerCase() ||
      Number.isNaN(endDate.getTime()) || endDate.getTime() <= Date.now() ||
      !isUuid(idempotencyKey)
    ) {
      return errorResponse(400, "VALIDATION_ERROR", "Election fields are invalid");
    }

    const fixedAuthorityId = cleanText(Deno.env.get("FIXED_AUTHORITY_ID"));
    if (!isUuid(fixedAuthorityId)) {
      return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority is not configured");
    }

    const supabase = createServiceRoleClient();

    const session = await validateWorldIdSession(supabase, sessionToken, {
      touchLastUsed: true,
    });
    if (!session.valid || !session.userId) {
      const expired = session.detail?.toLowerCase().includes("expired");
      return jsonResponse(401, {
        code: expired ? "SESSION_EXPIRED" : "SESSION_REQUIRED",
        error: session.detail || "World ID session validation failed",
      });
    }

    const { data: authority, error: authorityError } = await supabase
      .from("election_authorities")
      .select("id, auth_user_id, public_key_x, public_key_y")
      .eq("id", fixedAuthorityId)
      .maybeSingle();

    if (
      authorityError ||
      !authority ||
      !authority.auth_user_id ||
      isPlaceholderAuthorityKey({
        x: authority.public_key_x,
        y: authority.public_key_y,
      })
    ) {
      if (authorityError) {
        console.error("Fixed authority lookup failed", authorityError.code);
      }
      return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority is not ready");
    }

    const { data: matchingAuthorities, error: duplicateError } = await supabase
      .from("election_authorities")
      .select("id")
      .eq("public_key_x", authority.public_key_x)
      .eq("public_key_y", authority.public_key_y);
    if (duplicateError || matchingAuthorities?.length !== 1) {
      return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority configuration is ambiguous");
    }

    const { data: election, error: createError } = await supabase.rpc(
      "create_election_atomic",
      {
        p_creator: session.userId,
        p_authority_id: authority.id,
        p_title: title,
        p_description: description,
        p_option1: option1,
        p_option2: option2,
        p_end_date: endDate.toISOString(),
        p_idempotency_key: idempotencyKey,
      }
    );

    if (createError || !election) {
      console.error("Atomic election creation failed", createError?.code);
      return jsonResponse(500, {
        code: createError?.message === "FIXED_AUTHORITY_UNAVAILABLE"
          ? "FIXED_AUTHORITY_UNAVAILABLE"
          : "CONFLICT",
        error: "The election could not be created",
      });
    }

    return jsonResponse(200, {
      authorityId: authority.id,
      election,
    });
  } catch (error) {
    console.error(
      "create-election error",
      error instanceof Error ? error.name : "UnknownError"
    );
    return errorResponse(500, "INTERNAL_ERROR", "The election could not be created");
  }
});
