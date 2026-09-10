// Request handling for nullification-write, extracted so the accumulator
// continuity, key-binding and election-binding checks can be unit-tested with
// a fake supabase client and an injected proof verifier.
//
// A batch is accepted only when every proof verifies under the pinned
// verification key AND its public signals equal the real protocol state: the
// election's authority key, the targeted participant's registered key, the
// stored accumulator ciphertext and version, and the election id. The new
// accumulator is recomputed here from the verified signals; the client's copy
// is never trusted. Persistence is one transactional RPC.

import {
  computeAccumulatorUpdate,
  electionIdToField,
  equalCiphertexts,
  equalPoints,
  identityCiphertextJson,
  type JsonCiphertext,
  type JsonPoint,
  type NullificationProofPayload,
  type ParsedNullificationSignals,
  verifyNullificationProofPayload,
} from "../_shared/nullification.ts";
import { isElectionOpen } from "../_shared/election.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

/** Upper bound on slots per batch; the browser generates at most DEFAULT_K = 6. */
export const MAX_BATCH_SIZE = 16;

export interface NullificationBatchItem {
  accumulatorVersion: number;
  userId: string;
  zkp: NullificationProofPayload;
}

export interface SubmitNullificationBatchRequest {
  action?: "submit-batch";
  electionId: string;
  sessionToken: string;
  nullifications: NullificationBatchItem[];
}

export interface NullificationWriteDeps {
  supabase: SupabaseClient;
  /** Groth16 verification; injectable so tests can run without snarkjs. */
  verifyProof?: (payload: NullificationProofPayload) => Promise<ParsedNullificationSignals | null>;
  now?: () => number;
}

interface AccumulatorRow {
  acc_c1_x: string;
  acc_c1_y: string;
  acc_c2_x: string;
  acc_c2_y: string;
  version: number;
  voter_id: string;
}

interface ParticipantRow {
  participant_id: string;
  public_key_x: string;
  public_key_y: string;
}

// Field names match the jsonb keys read by public.submit_nullification_batch.
interface PreparedNullificationItem {
  accumulatorVersion: number;
  currentAccumulator: JsonCiphertext;
  ciphertext: JsonCiphertext;
  newAccumulator: JsonCiphertext;
  nullifierZkp: NullificationProofPayload;
  userId: string;
}

function accumulatorFromRow(row: AccumulatorRow): JsonCiphertext {
  return {
    c1: { x: row.acc_c1_x, y: row.acc_c1_y },
    c2: { x: row.acc_c2_x, y: row.acc_c2_y },
  };
}

/** Map the RPC's RAISE EXCEPTION messages onto HTTP statuses and codes. */
function mapPersistError(message: string): Response {
  if (message.includes("RATE_LIMITED")) {
    return errorResponse(429, "RATE_LIMITED", "Only one nullification batch per minute is accepted. Please retry shortly.");
  }
  if (message.includes("ELECTION_CLOSED")) {
    return errorResponse(409, "ELECTION_CLOSED", "Election is closed");
  }
  if (message.includes("mismatch")) {
    return errorResponse(409, "ACCUMULATOR_CONFLICT", message);
  }
  if (
    message.includes("not a participant") ||
    message.includes("must include the submitter") ||
    message.includes("incomplete item") ||
    message.includes("non-empty array") ||
    message.includes("exceeds the maximum")
  ) {
    return errorResponse(400, "VALIDATION_ERROR", message);
  }
  return errorResponse(500, "INTERNAL_ERROR", "Failed to persist nullification batch");
}

export async function handleNullificationWrite(
  deps: NullificationWriteDeps,
  body: SubmitNullificationBatchRequest
): Promise<Response> {
  const supabase = deps.supabase;
  const verifyProof = deps.verifyProof ?? verifyNullificationProofPayload;
  const now = deps.now ?? Date.now;

  // --- Request shape ---
  if (body.action && body.action !== "submit-batch") {
    return errorResponse(400, "VALIDATION_ERROR", "Unsupported action");
  }
  if (!body.electionId || !body.sessionToken || !Array.isArray(body.nullifications)) {
    return errorResponse(400, "VALIDATION_ERROR", "Missing electionId, sessionToken, or nullifications payload");
  }
  if (body.nullifications.length === 0 || body.nullifications.length > MAX_BATCH_SIZE) {
    return errorResponse(400, "VALIDATION_ERROR", `Nullification batches must contain between 1 and ${MAX_BATCH_SIZE} items`);
  }
  const targetUserIds = body.nullifications.map((item) => item.userId);
  if (new Set(targetUserIds).size !== targetUserIds.length) {
    return errorResponse(400, "VALIDATION_ERROR", "Nullification batches cannot target the same participant more than once");
  }

  // --- Submitter ---
  // Deliberately no last_used_at touch: a timestamp that coincides with the
  // batch's created_at would identify the submitter to anyone who can read
  // world_id_sessions.
  const session = await validateWorldIdSession(supabase, body.sessionToken);
  if (!session.valid || !session.userId) {
    return errorResponse(401, "SESSION_REQUIRED", session.detail || "Voter session validation failed");
  }
  if (!targetUserIds.includes(session.userId)) {
    return errorResponse(400, "VALIDATION_ERROR", "Nullification batch must include the submitter's participant slot");
  }

  // --- Election and authority ---
  const { data: election, error: electionError } = await supabase
    .from("elections")
    .select("id, authority_id, end_date, closed_manually_at")
    .eq("id", body.electionId)
    .maybeSingle();
  if (electionError) {
    console.error("Election lookup error:", electionError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load election");
  }
  if (!election?.authority_id) {
    return errorResponse(404, "NOT_FOUND", "Election not found or has no authority binding");
  }
  if (!isElectionOpen(election, now())) {
    return errorResponse(409, "ELECTION_CLOSED", "Election is closed");
  }

  const { data: authority, error: authorityError } = await supabase
    .from("election_authorities")
    .select("public_key_x, public_key_y")
    .eq("id", election.authority_id)
    .maybeSingle();
  if (authorityError || !authority) {
    console.error("Election authority lookup error:", authorityError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to resolve election authority");
  }
  const authorityPublicKey: JsonPoint = { x: authority.public_key_x, y: authority.public_key_y };

  // --- Targets: keys and current accumulator state ---
  const [{ data: participants, error: participantsError }, { data: accumulators, error: accumulatorsError }] =
    await Promise.all([
      supabase
        .from("election_participants")
        .select("participant_id, public_key_x, public_key_y")
        .eq("election_id", body.electionId)
        .in("participant_id", targetUserIds),
      supabase
        .from("nullification_accumulators")
        .select("voter_id, acc_c1_x, acc_c1_y, acc_c2_x, acc_c2_y, version")
        .eq("election_id", body.electionId)
        .in("voter_id", targetUserIds),
    ]);
  if (participantsError) {
    console.error("Participant lookup error:", participantsError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load election participants");
  }
  if (accumulatorsError) {
    console.error("Accumulator lookup error:", accumulatorsError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load accumulator state");
  }

  const participantRows = (participants || []) as ParticipantRow[];
  const participantKeysByUserId = new Map<string, JsonPoint>(
    participantRows.map((row) => [row.participant_id, { x: row.public_key_x, y: row.public_key_y }])
  );
  if (participantKeysByUserId.size !== targetUserIds.length) {
    return errorResponse(400, "VALIDATION_ERROR", "One or more nullification targets are not participants in this election");
  }
  if (!participantKeysByUserId.has(session.userId)) {
    return errorResponse(400, "PARTICIPANT_REQUIRED", "Submitter is not a participant in this election");
  }
  const accumulatorsByUserId = new Map<string, AccumulatorRow>(
    ((accumulators || []) as AccumulatorRow[]).map((row) => [row.voter_id, row])
  );

  // --- Verify each proof and bind its public signals to the real state ---
  const expectedElectionField = electionIdToField(election.id);
  const preparedItems: PreparedNullificationItem[] = [];
  for (const item of body.nullifications) {
    if (!item.userId || typeof item.accumulatorVersion !== "number" || !item.zkp) {
      return errorResponse(400, "VALIDATION_ERROR", "Nullification batch contains an incomplete item");
    }
    const parsed = await verifyProof(item.zkp);
    if (!parsed) {
      return errorResponse(400, "INVALID_PROOF", `Nullification proof verification failed for participant ${item.userId}`);
    }
    if (parsed.electionId !== expectedElectionField) {
      return errorResponse(400, "VALIDATION_ERROR", `Nullification proof is bound to a different election for participant ${item.userId}`);
    }
    if (!equalPoints(parsed.authorityPublicKey, authorityPublicKey)) {
      return errorResponse(400, "VALIDATION_ERROR", `Nullification proof authority key mismatch for participant ${item.userId}`);
    }
    if (!equalPoints(parsed.voterPublicKey, participantKeysByUserId.get(item.userId)!)) {
      return errorResponse(400, "VALIDATION_ERROR", `Nullification proof participant key mismatch for participant ${item.userId}`);
    }

    const stored = accumulatorsByUserId.get(item.userId);
    const currentAccumulator = stored ? accumulatorFromRow(stored) : identityCiphertextJson();
    const currentVersion = stored?.version ?? 0;
    if (currentVersion !== item.accumulatorVersion) {
      return errorResponse(409, "ACCUMULATOR_CONFLICT", `Accumulator version mismatch for participant ${item.userId}`);
    }
    if (!equalCiphertexts(parsed.accumulator, currentAccumulator)) {
      return errorResponse(409, "ACCUMULATOR_CONFLICT", `Accumulator state mismatch for participant ${item.userId}`);
    }

    preparedItems.push({
      accumulatorVersion: item.accumulatorVersion,
      ciphertext: parsed.ciphertext,
      currentAccumulator,
      newAccumulator: computeAccumulatorUpdate(parsed),
      nullifierZkp: item.zkp,
      userId: item.userId,
    });
  }

  // --- Persist transactionally (FOR UPDATE row locks, all-or-nothing) ---
  const { error } = await supabase.rpc("submit_nullification_batch", {
    p_election_id: body.electionId,
    p_submitter_id: session.userId,
    p_items: preparedItems,
  });
  if (error) {
    console.error("submit_nullification_batch RPC error:", error);
    return mapPersistError(error.message || "");
  }

  return jsonResponse(200, { processedRows: preparedItems.length, success: true });
}
