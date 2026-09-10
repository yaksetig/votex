// Validates a signed ballot and persists the canonical vote, tracking row,
// and public receipt atomically. Cryptographic message/signature formats are
// intentionally unchanged.

import { corsHeaders } from "../_shared/cors.ts";
import { isElectionOpen } from "../_shared/election.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import { verifyPoseidonSignature } from "../_shared/eddsa.ts";
import { buildVoteMessage } from "../_shared/protocol.ts";

const VOTE_TIMESTAMP_SKEW_MS = 10 * 60 * 1000;
// A serialised EdDSA-Poseidon payload (two coordinates, S, message) is well
// under 1 KB; the cap stops multi-megabyte blobs from being stored in
// votes.signature and served to every client through public_votes.
const MAX_SIGNATURE_LENGTH = 2048;
const MAX_CHOICE_LENGTH = 512;
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
      return errorResponse(400, "VALIDATION_ERROR", "Unsupported action");
    }

    if (!body.electionId || !body.sessionToken) {
      return errorResponse(401, "SESSION_REQUIRED", "Election and voter session are required");
    }

    if (
      typeof body.choice !== "string" ||
      !body.choice ||
      body.choice.length > MAX_CHOICE_LENGTH ||
      typeof body.signature !== "string" ||
      !body.signature ||
      body.signature.length > MAX_SIGNATURE_LENGTH ||
      !Number.isSafeInteger(body.timestamp) ||
      (body.idempotencyKey && !UUID_PATTERN.test(body.idempotencyKey))
    ) {
      return errorResponse(400, "VALIDATION_ERROR", "Choice, signature, timestamp, or idempotency key is invalid");
    }

    const supabase = createServiceRoleClient();

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
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load election");
    }
    if (!election) {
      return errorResponse(404, "NOT_FOUND", "Election not found");
    }
    if (!isElectionOpen(election)) {
      return errorResponse(409, "ELECTION_CLOSED", "Election is closed");
    }
    if (body.choice !== election.option1 && body.choice !== election.option2) {
      return errorResponse(400, "INVALID_CHOICE", "Choice does not match this election's options");
    }
    if (Math.abs(Date.now() - body.timestamp) > VOTE_TIMESTAMP_SKEW_MS) {
      return errorResponse(400, "INVALID_SIGNATURE", "Vote signature timestamp is stale");
    }

    const { data: participant, error: participantError } = await supabase
      .from("election_participants")
      .select("public_key_x, public_key_y")
      .eq("election_id", body.electionId)
      .eq("participant_id", session.userId)
      .maybeSingle();

    if (participantError) {
      console.error("Participant lookup failed", participantError.code);
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load participant");
    }
    if (!participant) {
      return errorResponse(409, "PARTICIPANT_REQUIRED", "Voter is not registered for this election");
    }

    const expectedMessage = buildVoteMessage(body.electionId, body.choice, body.timestamp);
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
      return errorResponse(401, "INVALID_SIGNATURE", "Vote signature verification failed");
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
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
  }
});
