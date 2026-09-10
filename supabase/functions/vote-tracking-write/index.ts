// Validates a signed ballot and persists the canonical vote, tracking row,
// and public receipt atomically. All logic lives in ./handler.ts.

import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse } from "../_shared/http.ts";
import { handleVoteWrite, type VoteWriteRequest } from "./handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as VoteWriteRequest;
    return await handleVoteWrite({ supabase: createServiceRoleClient() }, body);
  } catch (error) {
    console.error("vote-tracking-write error", error instanceof Error ? error.name : "UnknownError");
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
  }
});
