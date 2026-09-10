import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { handleSessionRequest, type SessionRequest } from "./handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceRoleClient();

    const body = (await req.json()) as SessionRequest;
    return await handleSessionRequest(supabase, body);
  } catch (error) {
    console.error("worldid-session error:", error);
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
  }
});
