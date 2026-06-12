// Vote write path.
//
// cast-vote: inserts the canonical votes row after validating the World ID
//   session, verifying the EdDSA vote signature against the voter's registered
//   key, and checking the election is open. Replaces the unvalidated
//   insert_vote() RPC (dropped in 20260611100400), then syncs the tracking row.
// sync-vote: legacy action that only syncs the tracking tables from an
//   existing canonical vote.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import { verifyPoseidonSignature } from "../_shared/eddsa.ts";

// Reject vote signatures whose embedded timestamp is too far from server time.
const VOTE_TIMESTAMP_SKEW_MS = 10 * 60 * 1000;

interface VoteWriteRequest {
  action?: "sync-vote" | "cast-vote";
  electionId: string;
  sessionToken: string;
  choice?: string;
  signature?: string;
  timestamp?: number;
}

// Without generated DB types the esm.sh client degrades table rows to
// `never`, so the helper takes the client untyped.
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

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

// Sync the yes_votes/no_votes tracking row for a voter's canonical vote.
async function syncTrackingRow(
  supabase: SupabaseClient,
  electionId: string,
  userId: string,
  choice: string,
  option1: string,
  option2: string
): Promise<Response | null> {
  const tableResolution = resolveTrackingTable(choice, option1, option2);

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
        .eq("election_id", electionId)
        .eq("voter_id", userId)
        .maybeSingle(),
      supabase
        .from(oppositeTable)
        .select("id, nullified, nullification_count")
        .eq("election_id", electionId)
        .eq("voter_id", userId)
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
        election_id: electionId,
        voter_id: userId,
        nullified: false,
        nullification_count: 0,
      });

    if (insertError) {
      console.error("Tracking row insert error:", insertError);
      return jsonResponse(500, { error: "Failed to create tracking row" });
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as VoteWriteRequest;
    const action = body.action ?? "sync-vote";

    if (action !== "sync-vote" && action !== "cast-vote") {
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
      .select("id, option1, option2, end_date, closed_manually_at")
      .eq("id", body.electionId)
      .maybeSingle();

    if (electionError) {
      console.error("Election lookup error:", electionError);
      return jsonResponse(500, { error: "Failed to load election" });
    }

    if (!election) {
      return jsonResponse(404, { error: "Election not found" });
    }

    if (action === "cast-vote") {
      if (!body.choice || !body.signature || typeof body.timestamp !== "number") {
        return jsonResponse(400, {
          error: "Missing choice, signature, or timestamp",
        });
      }

      if (
        election.closed_manually_at ||
        new Date(election.end_date).getTime() <= Date.now()
      ) {
        return jsonResponse(409, { error: "Election is closed" });
      }

      if (body.choice !== election.option1 && body.choice !== election.option2) {
        return jsonResponse(400, {
          error: "Choice does not match this election's options",
        });
      }

      if (Math.abs(Date.now() - body.timestamp) > VOTE_TIMESTAMP_SKEW_MS) {
        return jsonResponse(400, { error: "Vote signature timestamp is stale" });
      }

      const { data: participant, error: participantError } = await supabase
        .from("election_participants")
        .select("public_key_x, public_key_y")
        .eq("election_id", body.electionId)
        .eq("participant_id", session.userId)
        .maybeSingle();

      if (participantError) {
        console.error("Participant lookup error:", participantError);
        return jsonResponse(500, { error: "Failed to load participant" });
      }

      if (!participant) {
        return jsonResponse(409, {
          error: "Voter is not a registered participant in this election",
        });
      }

      const expectedMessage = `${body.electionId}:${body.choice}:${body.timestamp}`;
      let signatureValid = false;
      try {
        signatureValid = await verifyPoseidonSignature(
          body.signature,
          { x: participant.public_key_x, y: participant.public_key_y },
          expectedMessage
        );
      } catch (error) {
        console.error("Vote signature verification error:", error);
        signatureValid = false;
      }

      if (!signatureValid) {
        return jsonResponse(401, { error: "Vote signature verification failed" });
      }

      const { data: insertedVote, error: voteInsertError } = await supabase
        .from("votes")
        .insert({
          election_id: body.electionId,
          voter: session.userId,
          choice: body.choice,
          signature: body.signature,
          timestamp: body.timestamp,
          nullifier: null,
        })
        .select("id")
        .single();

      if (voteInsertError) {
        // 23505 = unique violation on votes(election_id, voter)
        if (voteInsertError.code === "23505") {
          return jsonResponse(409, {
            error: "A vote has already been cast for this identity in this election",
          });
        }

        console.error("Vote insert error:", voteInsertError);
        return jsonResponse(500, { error: "Failed to record vote" });
      }

      const trackingFailure = await syncTrackingRow(
        supabase,
        body.electionId,
        session.userId,
        body.choice,
        election.option1,
        election.option2
      );

      if (trackingFailure) {
        return trackingFailure;
      }

      return jsonResponse(200, {
        success: true,
        voteId: insertedVote.id,
        userId: session.userId,
      });
    }

    // sync-vote: backfill tracking from the existing canonical vote
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

    const trackingFailure = await syncTrackingRow(
      supabase,
      body.electionId,
      session.userId,
      vote.choice,
      election.option1,
      election.option2
    );

    if (trackingFailure) {
      return trackingFailure;
    }

    return jsonResponse(200, {
      success: true,
      userId: session.userId,
    });
  } catch (error) {
    console.error("vote-tracking-write error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
