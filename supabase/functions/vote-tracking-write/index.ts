import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncVoteRequest {
  action?: "sync-vote";
  electionId: string;
  sessionToken: string;
}

interface SessionValidationResult {
  valid: boolean;
  detail?: string;
  userId?: string;
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

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function validateWorldIdSession(
  supabase: ReturnType<typeof createClient>,
  sessionToken: string
): Promise<SessionValidationResult> {
  const tokenHash = await sha256Hex(sessionToken);
  const { data: session, error: sessionError } = await supabase
    .from("world_id_sessions")
    .select("expires_at, nullifier_hash, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError) {
    console.error("Session lookup error:", sessionError);
    return { valid: false, detail: "Failed to validate voter session" };
  }

  if (!session || session.revoked_at) {
    return { valid: false, detail: "Voter session is invalid or revoked" };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("world_id_sessions")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);

    return { valid: false, detail: "Voter session has expired" };
  }

  return { valid: true, userId: session.nullifier_hash };
}

function resolveTrackingTable(
  voteChoice: string,
  option1: string,
  option2: string
): { targetTable: "yes_votes" | "no_votes"; oppositeTable: "yes_votes" | "no_votes" } | null {
  if (voteChoice === option1 || voteChoice === "Yes") {
    return { targetTable: "yes_votes", oppositeTable: "no_votes" };
  }

  if (voteChoice === option2 || voteChoice === "No") {
    return { targetTable: "no_votes", oppositeTable: "yes_votes" };
  }

  return null;
}

function isTrackingRowFinalized(row: {
  nullified: boolean;
  nullification_count: number;
} | null): boolean {
  return !!row && (row.nullified || row.nullification_count !== 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SyncVoteRequest;

    if (body.action && body.action !== "sync-vote") {
      return jsonResponse(400, { error: "Unsupported action" });
    }

    if (!body.electionId || !body.sessionToken) {
      return jsonResponse(400, {
        error: "Missing electionId or sessionToken",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const session = await validateWorldIdSession(supabase, body.sessionToken);
    if (!session.valid || !session.userId) {
      return jsonResponse(401, {
        error: session.detail || "Voter session validation failed",
      });
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, option1, option2")
      .eq("id", body.electionId)
      .maybeSingle();

    if (electionError) {
      console.error("Election lookup error:", electionError);
      return jsonResponse(500, { error: "Failed to load election" });
    }

    if (!election) {
      return jsonResponse(404, { error: "Election not found" });
    }

    const { data: vote, error: voteError } = await supabase
      .from("votes")
      .select("choice")
      .eq("election_id", body.electionId)
      .eq("voter", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (voteError) {
      console.error("Canonical vote lookup error:", voteError);
      return jsonResponse(500, { error: "Failed to load canonical vote" });
    }

    if (!vote) {
      return jsonResponse(409, {
        error: "No canonical vote exists for this voter and election",
      });
    }

    const tableResolution = resolveTrackingTable(
      vote.choice,
      election.option1,
      election.option2
    );

    if (!tableResolution) {
      return jsonResponse(400, {
        error: "Canonical vote choice does not match this election's options",
      });
    }

    const { targetTable, oppositeTable } = tableResolution;

    const [{ data: targetRow, error: targetLookupError }, { data: oppositeRow, error: oppositeLookupError }] =
      await Promise.all([
        supabase
          .from(targetTable)
          .select("id, nullified, nullification_count")
          .eq("election_id", body.electionId)
          .eq("voter_id", session.userId)
          .maybeSingle(),
        supabase
          .from(oppositeTable)
          .select("id, nullified, nullification_count")
          .eq("election_id", body.electionId)
          .eq("voter_id", session.userId)
          .maybeSingle(),
      ]);

    if (targetLookupError || oppositeLookupError) {
      console.error("Tracking row lookup error:", targetLookupError || oppositeLookupError);
      return jsonResponse(500, { error: "Failed to load tracking rows" });
    }

    if (isTrackingRowFinalized(targetRow) || isTrackingRowFinalized(oppositeRow)) {
      return jsonResponse(409, {
        error: "Vote tracking has already been finalized and cannot be reset",
      });
    }

    if (oppositeRow) {
      const { error: deleteError } = await supabase
        .from(oppositeTable)
        .delete()
        .eq("id", oppositeRow.id);

      if (deleteError) {
        console.error("Opposite tracking row delete error:", deleteError);
        return jsonResponse(500, { error: "Failed to clean up stale tracking row" });
      }
    }

    if (!targetRow) {
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert({
          election_id: body.electionId,
          voter_id: session.userId,
          nullified: false,
          nullification_count: 0,
        });

      if (insertError) {
        console.error("Tracking row insert error:", insertError);
        return jsonResponse(500, { error: "Failed to create tracking row" });
      }
    }

    return jsonResponse(200, {
      success: true,
      table: targetTable,
      userId: session.userId,
    });
  } catch (error) {
    console.error("vote-tracking-write error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
