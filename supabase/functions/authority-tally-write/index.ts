import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TallyResultInput {
  userId: string;
  nullificationCount: number;
  voteNullified: boolean;
  voteWeight?: number;
}

interface StoreResultsRequest {
  action?: "store-results";
  electionId: string;
  processedBy?: string | null;
  results: TallyResultInput[];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization header" });
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
      console.error("Authority user lookup error:", userError);
      return jsonResponse(401, { error: "Invalid authority session" });
    }

    const body = (await req.json()) as StoreResultsRequest;

    if (body.action && body.action !== "store-results") {
      return jsonResponse(400, { error: "Unsupported action" });
    }

    if (!body.electionId || !Array.isArray(body.results)) {
      return jsonResponse(400, {
        error: "Missing electionId or results payload",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: authority, error: authorityError } = await supabase
      .from("election_authorities")
      .select("id, name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (authorityError) {
      console.error("Authority lookup error:", authorityError);
      return jsonResponse(500, { error: "Failed to load authority record" });
    }

    if (!authority) {
      return jsonResponse(403, { error: "No election authority is linked to this user" });
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id")
      .eq("id", body.electionId)
      .eq("authority_id", authority.id)
      .maybeSingle();

    if (electionError) {
      console.error("Election ownership lookup error:", electionError);
      return jsonResponse(500, { error: "Failed to load election" });
    }

    if (!election) {
      return jsonResponse(403, {
        error: "The current authority does not own this election",
      });
    }

    const uniqueUserIds = [...new Set(body.results.map((result) => result.userId))];
    if (uniqueUserIds.length === 0) {
      return jsonResponse(200, { success: true, updatedRows: 0, tallyRows: 0 });
    }

    const [yesRowsResult, noRowsResult] = await Promise.all([
      supabase
        .from("yes_votes")
        .select("id, voter_id")
        .eq("election_id", body.electionId)
        .in("voter_id", uniqueUserIds),
      supabase
        .from("no_votes")
        .select("id, voter_id")
        .eq("election_id", body.electionId)
        .in("voter_id", uniqueUserIds),
    ]);

    if (yesRowsResult.error || noRowsResult.error) {
      console.error("Tracking row lookup error:", yesRowsResult.error || noRowsResult.error);
      return jsonResponse(500, { error: "Failed to load vote tracking rows" });
    }

    const yesRowByVoter = new Map(
      (yesRowsResult.data || []).map((row) => [row.voter_id, row.id])
    );
    const noRowByVoter = new Map(
      (noRowsResult.data || []).map((row) => [row.voter_id, row.id])
    );

    const missingVoters = uniqueUserIds.filter(
      (userId) => !yesRowByVoter.has(userId) && !noRowByVoter.has(userId)
    );

    if (missingVoters.length > 0) {
      return jsonResponse(400, {
        error: "One or more tally results do not map to tracked votes",
        missingVoters,
      });
    }

    const processedAt = new Date().toISOString();
    const processedBy = authority.name;

    const yesUpdates = body.results
      .filter((result) => yesRowByVoter.has(result.userId))
      .map((result) => ({
        id: yesRowByVoter.get(result.userId)!,
        election_id: body.electionId,
        voter_id: result.userId,
        nullification_count: result.nullificationCount,
        nullified: result.voteNullified,
        updated_at: processedAt,
      }));

    const noUpdates = body.results
      .filter((result) => noRowByVoter.has(result.userId))
      .map((result) => ({
        id: noRowByVoter.get(result.userId)!,
        election_id: body.electionId,
        voter_id: result.userId,
        nullification_count: result.nullificationCount,
        nullified: result.voteNullified,
        updated_at: processedAt,
      }));

    if (yesUpdates.length > 0) {
      const { error: yesUpdateError } = await supabase
        .from("yes_votes")
        .upsert(yesUpdates, {
          onConflict: "id",
        });

      if (yesUpdateError) {
        console.error("yes_votes update error:", yesUpdateError);
        return jsonResponse(500, { error: "Failed to update yes vote tracking" });
      }
    }

    if (noUpdates.length > 0) {
      const { error: noUpdateError } = await supabase
        .from("no_votes")
        .upsert(noUpdates, {
          onConflict: "id",
        });

      if (noUpdateError) {
        console.error("no_votes update error:", noUpdateError);
        return jsonResponse(500, { error: "Failed to update no vote tracking" });
      }
    }

    const tallyRows = body.results.map((result) => ({
      election_id: body.electionId,
      user_id: result.userId,
      nullification_count: result.nullificationCount,
      vote_nullified: result.voteNullified,
      vote_weight: result.voteWeight ?? 1,
      processed_at: processedAt,
      processed_by: processedBy,
    }));

    const { error: tallyError } = await supabase
      .from("election_tallies")
      .upsert(tallyRows, {
        onConflict: "election_id,user_id",
        ignoreDuplicates: false,
      });

    if (tallyError) {
      console.error("election_tallies upsert error:", tallyError);
      return jsonResponse(500, { error: "Failed to store tally rows" });
    }

    return jsonResponse(200, {
      success: true,
      processedAt,
      processedBy,
      tallyRows: tallyRows.length,
      updatedRows: yesUpdates.length + noUpdates.length,
    });
  } catch (error) {
    console.error("authority-tally-write error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
