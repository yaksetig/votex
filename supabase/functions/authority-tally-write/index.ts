// Persists one complete tally run atomically after validating the authenticated
// fixed Election Authority. Tally computation and cryptographic formats remain
// client-side and unchanged.

import { corsHeaders } from "../_shared/cors.ts";
import { isElectionOpen } from "../_shared/election.ts";
import { createServiceRoleClient, getAuthenticatedUser } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";

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
      return errorResponse(401, "AUTHORITY_REQUIRED", "Missing authorization header");
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return errorResponse(401, "AUTHORITY_REQUIRED", "Invalid authority session");
    }

    const body = (await req.json()) as StoreResultsRequest;
    const action = body.action ?? "store-results";
    if (action !== "store-results" && action !== "replace-results") {
      return errorResponse(400, "VALIDATION_ERROR", "Unsupported action");
    }
    if (!body.electionId || !Array.isArray(body.results)) {
      return errorResponse(400, "VALIDATION_ERROR", "Missing electionId or results payload");
    }

    const fixedAuthorityId = Deno.env.get("FIXED_AUTHORITY_ID")?.trim();
    if (!fixedAuthorityId) {
      return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority is not configured");
    }

    const supabase = createServiceRoleClient();
    const { data: authority, error: authorityError } = await supabase
      .from("election_authorities")
      .select("id, name")
      .eq("id", fixedAuthorityId)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (authorityError) {
      console.error("Fixed authority lookup failed", authorityError.code);
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load authority");
    }
    if (!authority) {
      return errorResponse(403, "AUTHORITY_REQUIRED", "The current account is not the fixed Election Authority");
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, end_date, closed_manually_at")
      .eq("id", body.electionId)
      .eq("authority_id", authority.id)
      .maybeSingle();

    if (electionError) {
      console.error("Election ownership lookup failed", electionError.code);
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load election");
    }
    if (!election) {
      return errorResponse(403, "AUTHORITY_REQUIRED", "The fixed Election Authority does not own this election");
    }
    if (isElectionOpen(election)) {
      return errorResponse(409, "ELECTION_STILL_ACTIVE", "Election is still active");
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
      const incomplete = tallyError.message === "INCOMPLETE_TALLY_RESULTS";
      return jsonResponse(alreadyProcessed ? 409 : incomplete ? 400 : 500, {
        code: alreadyProcessed ? "CONFLICT" : "VALIDATION_ERROR",
        error: alreadyProcessed
          ? "A tally has already been processed for this election"
          : incomplete
          ? "The tally result set is incomplete or contains unexpected voters"
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
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
  }
});
