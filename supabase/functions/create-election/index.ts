// Creates an election for a server-validated World ID session and always binds
// it to the single configured Election Authority. All logic lives in ./handler.ts.

import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse } from "../_shared/http.ts";
import { handleCreateElection, type CreateElectionRequest } from "./handler.ts";

const MAX_REQUEST_BYTES = 16_384;

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

    return await handleCreateElection(
      { supabase: createServiceRoleClient(), fixedAuthorityId: Deno.env.get("FIXED_AUTHORITY_ID") },
      body
    );
  } catch (error) {
    console.error("create-election error", error instanceof Error ? error.name : "UnknownError");
    return errorResponse(500, "INTERNAL_ERROR", "The election could not be created");
  }
});
