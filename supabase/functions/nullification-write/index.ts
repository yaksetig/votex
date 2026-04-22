import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  computeAccumulatorUpdate,
  equalCiphertexts,
  equalPoints,
  identityCiphertextJson,
  type JsonCiphertext,
  type JsonPoint,
  type NullificationProofPayload,
  verifyNullificationProofPayload,
} from "../_shared/nullification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_BATCH_SIZE = 16;

interface SubmitNullificationBatchRequest {
  action?: "submit-batch";
  electionId: string;
  sessionToken: string;
  nullifications: Array<{
    accumulatorVersion: number;
    userId: string;
    zkp: NullificationProofPayload;
  }>;
}

interface SessionValidationResult {
  valid: boolean;
  detail?: string;
  userId?: string;
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
    console.error("Nullification session lookup error:", sessionError);
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

  await supabase
    .from("world_id_sessions")
    .update({
      last_used_at: new Date().toISOString(),
    })
    .eq("token_hash", tokenHash);

  return { valid: true, userId: session.nullifier_hash };
}

function accumulatorFromRow(row: AccumulatorRow): JsonCiphertext {
  return {
    c1: {
      x: row.acc_c1_x,
      y: row.acc_c1_y,
    },
    c2: {
      x: row.acc_c2_x,
      y: row.acc_c2_y,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SubmitNullificationBatchRequest;

    if (body.action && body.action !== "submit-batch") {
      return jsonResponse(400, { error: "Unsupported action" });
    }

    if (!body.electionId || !body.sessionToken || !Array.isArray(body.nullifications)) {
      return jsonResponse(400, {
        error: "Missing electionId, sessionToken, or nullifications payload",
      });
    }

    if (body.nullifications.length === 0 || body.nullifications.length > MAX_BATCH_SIZE) {
      return jsonResponse(400, {
        error: `Nullification batches must contain between 1 and ${MAX_BATCH_SIZE} items`,
      });
    }

    const targetUserIds = body.nullifications.map((item) => item.userId);
    if (new Set(targetUserIds).size !== targetUserIds.length) {
      return jsonResponse(400, {
        error: "Nullification batches cannot target the same participant more than once",
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

    if (!targetUserIds.includes(session.userId)) {
      return jsonResponse(400, {
        error: "Nullification batch must include the submitter's participant slot",
      });
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, authority_id")
      .eq("id", body.electionId)
      .maybeSingle();

    if (electionError) {
      console.error("Election lookup error:", electionError);
      return jsonResponse(500, { error: "Failed to load election" });
    }

    if (!election?.authority_id) {
      return jsonResponse(404, { error: "Election not found or has no authority binding" });
    }

    const { data: authority, error: authorityError } = await supabase
      .from("election_authorities")
      .select("public_key_x, public_key_y")
      .eq("id", election.authority_id)
      .maybeSingle();

    if (authorityError || !authority) {
      console.error("Election authority lookup error:", authorityError);
      return jsonResponse(500, { error: "Failed to resolve election authority" });
    }

    const authorityPublicKey: JsonPoint = {
      x: authority.public_key_x,
      y: authority.public_key_y,
    };

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
      return jsonResponse(500, { error: "Failed to load election participants" });
    }

    if (accumulatorsError) {
      console.error("Accumulator lookup error:", accumulatorsError);
      return jsonResponse(500, { error: "Failed to load accumulator state" });
    }

    const participantRows = (participants || []) as ParticipantRow[];
    const participantIds = new Set(participantRows.map((row) => row.participant_id));
    if (participantIds.size !== targetUserIds.length) {
      return jsonResponse(400, {
        error: "One or more nullification targets are not participants in this election",
      });
    }

    if (!participantIds.has(session.userId)) {
      return jsonResponse(400, {
        error: "Submitter is not a participant in this election",
      });
    }

    const participantKeysByUserId = new Map(
      participantRows.map((row) => [
        row.participant_id,
        {
          x: row.public_key_x,
          y: row.public_key_y,
        } as JsonPoint,
      ])
    );

    const accumulatorsByUserId = new Map(
      (accumulators || []).map((row) => [row.voter_id, row as AccumulatorRow])
    );

    const rpcItems = [];
    for (const item of body.nullifications) {
      if (!item.userId || typeof item.accumulatorVersion !== "number" || !item.zkp) {
        return jsonResponse(400, { error: "Nullification batch contains an incomplete item" });
      }

      const parsed = await verifyNullificationProofPayload(item.zkp);
      if (!parsed) {
        return jsonResponse(400, {
          error: `Nullification proof verification failed for participant ${item.userId}`,
        });
      }

      if (!equalPoints(parsed.authorityPublicKey, authorityPublicKey)) {
        return jsonResponse(400, {
          error: `Nullification proof authority key mismatch for participant ${item.userId}`,
        });
      }

      const targetParticipantKey = participantKeysByUserId.get(item.userId);
      if (!targetParticipantKey) {
        return jsonResponse(400, {
          error: `Nullification target ${item.userId} is missing a participant key`,
        });
      }

      if (!equalPoints(parsed.voterPublicKey, targetParticipantKey)) {
        return jsonResponse(400, {
          error: `Nullification proof participant key mismatch for participant ${item.userId}`,
        });
      }

      const currentAccumulator = accumulatorsByUserId.has(item.userId)
        ? accumulatorFromRow(accumulatorsByUserId.get(item.userId)!)
        : identityCiphertextJson();
      const currentVersion = accumulatorsByUserId.get(item.userId)?.version ?? 0;

      if (currentVersion !== item.accumulatorVersion) {
        return jsonResponse(409, {
          error: `Accumulator version mismatch for participant ${item.userId}`,
        });
      }

      if (!equalCiphertexts(parsed.accumulator, currentAccumulator)) {
        return jsonResponse(409, {
          error: `Accumulator state mismatch for participant ${item.userId}`,
        });
      }

      rpcItems.push({
        userId: item.userId,
        accumulatorVersion: item.accumulatorVersion,
        ciphertext: parsed.ciphertext,
        currentAccumulator,
        newAccumulator: computeAccumulatorUpdate(parsed),
        nullifierZkp: item.zkp,
      });
    }

    const { data, error } = await supabase.rpc("submit_nullification_batch", {
      p_election_id: body.electionId,
      p_items: rpcItems,
      p_submitter_id: session.userId,
    });

    if (error) {
      console.error("submit_nullification_batch RPC error:", error);
      const conflict =
        error.message.includes("Accumulator version mismatch") ||
        error.message.includes("Accumulator state mismatch") ||
        error.message.includes("bootstrap mismatch") ||
        error.message.includes("duplicate key");

      return jsonResponse(conflict ? 409 : 500, {
        error: error.message || "Failed to persist nullification batch",
      });
    }

    return jsonResponse(200, data ?? { success: true });
  } catch (error) {
    console.error("nullification-write error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
