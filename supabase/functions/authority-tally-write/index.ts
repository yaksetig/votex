// Persists one complete tally run atomically after validating the authenticated
// fixed Election Authority. Tally computation and cryptographic formats remain
// client-side and unchanged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";

interface TallyResultInput {
  userId: string;
  nullificationCount: number;
  voteNullified: boolean;
  voteWeight?: number;
}

interface StoreResultsRequest {
  action?: "store-results" | "replace-results";
  electionId: string;
  results: TallyResultInput[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, {
        code: "AUTHORITY_REQUIRED",
        error: "Missing authorization header",
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse(401, {
        code: "AUTHORITY_REQUIRED",
        error: "Invalid authority session",
      });
    }

    const body = (await req.json()) as StoreResultsRequest;
    const action = body.action ?? "store-results";
    if (action !== "store-results" && action !== "replace-results") {
      return jsonResponse(400, { code: "VALIDATION_ERROR", error: "Unsupported action" });
    }
    if (!body.electionId || !Array.isArray(body.results)) {
      return jsonResponse(400, {
        code: "VALIDATION_ERROR",
        error: "Missing electionId or results payload",
      });
    }

    const fixedAuthorityId = Deno.env.get("FIXED_AUTHORITY_ID")?.trim();
    if (!fixedAuthorityId) {
      return jsonResponse(503, {
        code: "FIXED_AUTHORITY_UNAVAILABLE",
        error: "The fixed Election Authority is not configured",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: authority, error: authorityError } = await supabase
      .from("election_authorities")
      .select("id, name")
      .eq("id", fixedAuthorityId)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (authorityError) {
      console.error("Fixed authority lookup failed", authorityError.code);
      return jsonResponse(500, { code: "CONFLICT", error: "Failed to load authority" });
    }
    if (!authority) {
      return jsonResponse(403, {
        code: "AUTHORITY_REQUIRED",
        error: "The current account is not the fixed Election Authority",
      });
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, end_date, closed_manually_at")
      .eq("id", body.electionId)
      .eq("authority_id", authority.id)
      .maybeSingle();

    if (electionError) {
      console.error("Election ownership lookup failed", electionError.code);
      return jsonResponse(500, { code: "CONFLICT", error: "Failed to load election" });
    }
    if (!election) {
      return jsonResponse(403, {
        code: "AUTHORITY_REQUIRED",
        error: "The fixed Election Authority does not own this election",
      });
    }
    if (!election.closed_manually_at && new Date(election.end_date).getTime() > Date.now()) {
      return jsonResponse(409, {
        code: "ELECTION_STILL_ACTIVE",
        error: "Election is still active",
      });
    }

    const normalizedResults = body.results.map((result) => ({
      user_id: result.userId,
      nullification_count: result.nullificationCount,
      vote_nullified: result.voteNullified,
      vote_weight: result.voteWeight ?? 1,
    }));

    const { data: tallyRunId, error: tallyError } = await supabase.rpc(
      "store_tally_results_atomic",
      {
        p_election_id: body.electionId,
        p_processed_by: authority.name,
        p_results: normalizedResults,
        p_replace_existing: action === "replace-results",
      }
    );

    if (tallyError) {
      console.error("Atomic tally write failed", tallyError.code);
      const alreadyProcessed = tallyError.message === "TALLY_ALREADY_PROCESSED";
      return jsonResponse(alreadyProcessed ? 409 : 500, {
        code: alreadyProcessed ? "CONFLICT" : "VALIDATION_ERROR",
        error: alreadyProcessed
          ? "A tally has already been processed for this election"
          : "The tally results could not be stored",
      });
    }

    return jsonResponse(200, {
      success: true,
      processedAt: new Date().toISOString(),
      processedBy: authority.name,
      tallyRows: normalizedResults.length,
      tallyRunId,
    });
  } catch (error) {
    console.error(
      "authority-tally-write error",
      error instanceof Error ? error.name : "UnknownError"
    );
    return jsonResponse(500, { code: "CONFLICT", error: "Internal server error" });
  }
});
