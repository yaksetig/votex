// Validates a signed ballot and persists the canonical vote, tracking row,
// and public receipt atomically. Cryptographic message/signature formats are
// intentionally unchanged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import { verifyPoseidonSignature } from "../_shared/eddsa.ts";

const VOTE_TIMESTAMP_SKEW_MS = 10 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface VoteWriteRequest {
  action?: "cast-vote";
  electionId: string;
  sessionToken: string;
  choice: string;
  signature: string;
  timestamp: number;
  idempotencyKey?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as VoteWriteRequest;

    if (body.action && body.action !== "cast-vote") {
      return jsonResponse(400, {
        code: "UNSUPPORTED_ACTION",
        error: "Unsupported action",
      });
    }

    if (!body.electionId || !body.sessionToken) {
      return jsonResponse(401, {
        code: "SESSION_REQUIRED",
        error: "Election and voter session are required",
      });
    }

    if (
      !body.choice ||
      !body.signature ||
      typeof body.timestamp !== "number" ||
      (body.idempotencyKey && !UUID_PATTERN.test(body.idempotencyKey))
    ) {
      return jsonResponse(400, {
        code: "VALIDATION_ERROR",
        error: "Choice, signature, timestamp, or idempotency key is invalid",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const session = await validateWorldIdSession(supabase, body.sessionToken, {
      touchLastUsed: true,
    });
    if (!session.valid || !session.userId) {
      const expired = session.detail?.toLowerCase().includes("expired");
      return jsonResponse(401, {
        code: expired ? "SESSION_EXPIRED" : "SESSION_REQUIRED",
        error: session.detail || "Voter session validation failed",
      });
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, title, option1, option2, end_date, closed_manually_at")
      .eq("id", body.electionId)
      .maybeSingle();

    if (electionError) {
      console.error("Election lookup failed", electionError.code);
      return jsonResponse(500, {
        code: "CONFLICT",
        error: "Failed to load election",
      });
    }
    if (!election) {
      return jsonResponse(404, {
        code: "ELECTION_NOT_FOUND",
        error: "Election not found",
      });
    }
    if (
      election.closed_manually_at ||
      new Date(election.end_date).getTime() <= Date.now()
    ) {
      return jsonResponse(409, {
        code: "ELECTION_CLOSED",
        error: "Election is closed",
      });
    }
    if (body.choice !== election.option1 && body.choice !== election.option2) {
      return jsonResponse(400, {
        code: "INVALID_CHOICE",
        error: "Choice does not match this election's options",
      });
    }
    if (Math.abs(Date.now() - body.timestamp) > VOTE_TIMESTAMP_SKEW_MS) {
      return jsonResponse(400, {
        code: "INVALID_SIGNATURE",
        error: "Vote signature timestamp is stale",
      });
    }

    const { data: participant, error: participantError } = await supabase
      .from("election_participants")
      .select("public_key_x, public_key_y")
      .eq("election_id", body.electionId)
      .eq("participant_id", session.userId)
      .maybeSingle();

    if (participantError) {
      console.error("Participant lookup failed", participantError.code);
      return jsonResponse(500, {
        code: "CONFLICT",
        error: "Failed to load participant",
      });
    }
    if (!participant) {
      return jsonResponse(409, {
        code: "PARTICIPANT_REQUIRED",
        error: "Voter is not registered for this election",
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
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      return jsonResponse(401, {
        code: "INVALID_SIGNATURE",
        error: "Vote signature verification failed",
      });
    }

    const { data: result, error: writeError } = await supabase.rpc(
      "cast_vote_atomic",
      {
        p_election_id: body.electionId,
        p_voter: session.userId,
        p_choice: body.choice,
        p_signature: body.signature,
        p_timestamp: body.timestamp,
      }
    );

    const receipt = Array.isArray(result) ? result[0] : result;
    if (writeError || !receipt) {
      console.error("Atomic vote write failed", writeError?.code);
      const code = writeError?.message === "ELECTION_CLOSED"
        ? "ELECTION_CLOSED"
        : writeError?.message === "PARTICIPANT_REQUIRED"
        ? "PARTICIPANT_REQUIRED"
        : "CONFLICT";
      return jsonResponse(code === "ELECTION_CLOSED" ? 409 : 500, {
        code,
        error: "The ballot could not be recorded",
      });
    }

    return jsonResponse(200, {
      success: true,
      alreadyExisted: receipt.already_existed,
      receipt: {
        receiptId: receipt.receipt_id,
        electionId: body.electionId,
        electionTitle: election.title,
        voterPseudonym: session.userId,
        choice: receipt.recorded_choice,
        signature: receipt.recorded_signature,
        signedAt: receipt.recorded_timestamp,
        acceptedAt: receipt.accepted_at,
        signatureVerified: true,
      },
    });
  } catch (error) {
    console.error(
      "vote-tracking-write error",
      error instanceof Error ? error.name : "UnknownError"
    );
    return jsonResponse(500, {
      code: "CONFLICT",
      error: "Internal server error",
    });
  }
});
