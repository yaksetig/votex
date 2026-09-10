// Verifies a k-anonymity nullification batch and applies it transactionally.
// All logic lives in ./handler.ts.

import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse } from "../_shared/http.ts";
import { handleNullificationWrite, type SubmitNullificationBatchRequest } from "./handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SubmitNullificationBatchRequest;
    return await handleNullificationWrite({ supabase: createServiceRoleClient() }, body);
  } catch (error) {
    console.error("nullification-write error:", error);
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
  }
});
