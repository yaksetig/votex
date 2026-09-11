// Request handling for vote-tracking-write, extracted so the validation and
// signature checks can be unit-tested with a fake supabase client.
//
// A ballot is accepted only when: the voter session is valid, the election is
// open, the choice is one of the election's two options, the signed timestamp
// is fresh, and the EdDSA-Poseidon signature over `electionId:choice:timestamp`
// verifies against the key registered for this voter in this election. The
// canonical vote, tracking row and receipt are then written in one
// transaction by cast_vote_atomic.

import { isElectionOpen } from "../_shared/election.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import { verifyPoseidonSignature } from "../_shared/eddsa.ts";
import { buildVoteMessage, MAX_SIGNATURE_PAYLOAD_LENGTH } from "../_shared/protocol.ts";
import { isUuid } from "../_shared/fixedAuthority.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

export const VOTE_TIMESTAMP_SKEW_MS = 10 * 60 * 1000;
/** The signature is stored in votes.signature and served through public_votes. */
export const MAX_SIGNATURE_LENGTH = MAX_SIGNATURE_PAYLOAD_LENGTH;
export const MAX_CHOICE_LENGTH = 512;

export interface VoteWriteRequest {
  action?: "cast-vote";
  electionId: string;
  sessionToken: string;
  choice: string;
  signature: string;
  timestamp: number;
  idempotencyKey?: string;
}

export interface VoteWriteDeps {
  supabase: SupabaseClient;
  now?: () => number;
}

interface CastVoteReceipt {
  receipt_id: string;
  already_existed: boolean;
  recorded_choice: string;
  recorded_signature: string;
  recorded_timestamp: number;
  accepted_at: string;
}

export async function handleVoteWrite(deps: VoteWriteDeps, body: VoteWriteRequest): Promise<Response> {
  const now = deps.now ?? Date.now;
  const supabase = deps.supabase;

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
    (body.idempotencyKey && !isUuid(body.idempotencyKey))
  ) {
    return errorResponse(400, "VALIDATION_ERROR", "Choice, signature, timestamp, or idempotency key is invalid");
  }

  const session = await validateWorldIdSession(supabase, body.sessionToken, { touchLastUsed: true });
  if (!session.valid || !session.userId) {
    const expired = session.detail?.toLowerCase().includes("expired");
    return errorResponse(
      401,
      expired ? "SESSION_EXPIRED" : "SESSION_REQUIRED",
      session.detail || "Voter session validation failed"
    );
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
  if (!isElectionOpen(election, now())) {
    return errorResponse(409, "ELECTION_CLOSED", "Election is closed");
  }
  if (body.choice !== election.option1 && body.choice !== election.option2) {
    return errorResponse(400, "INVALID_CHOICE", "Choice does not match this election's options");
  }
  if (Math.abs(now() - body.timestamp) > VOTE_TIMESTAMP_SKEW_MS) {
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

  const { data: result, error: writeError } = await supabase.rpc("cast_vote_atomic", {
    p_election_id: body.electionId,
    p_voter: session.userId,
    p_choice: body.choice,
    p_signature: body.signature,
    p_timestamp: body.timestamp,
  });
  const receipt = (Array.isArray(result) ? result[0] : result) as CastVoteReceipt | null;
  if (writeError || !receipt) {
    console.error("Atomic vote write failed", writeError?.code);
    if (writeError?.message === "ELECTION_CLOSED") {
      return errorResponse(409, "ELECTION_CLOSED", "Election is closed");
    }
    if (writeError?.message === "PARTICIPANT_REQUIRED") {
      return errorResponse(409, "PARTICIPANT_REQUIRED", "Voter is not registered for this election");
    }
    return errorResponse(500, "INTERNAL_ERROR", "The ballot could not be recorded");
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
}
