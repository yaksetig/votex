// Creates or revokes a vote delegation for the session holder.
//
// Replaces the direct client writes to delegations (locked down in
// 20260611100200). The delegator id always comes from the validated World ID
// session, never from the request body, so a delegation cannot be forged or
// revoked on behalf of another voter.
//
// Since 2026-09-09 every request must also carry an EdDSA-Poseidon signature
// by the delegator's registered voting key over the exact action (see
// _shared/delegation.ts). A stolen session alone can no longer delegate a
// voter's ballot away.

import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import { isCanonicalPrimeSubgroupPoint } from "../_shared/babyjub.ts";
import {
  type DelegationAuthorization,
  type DelegationCiphertext,
  verifyDelegationAuthorization,
} from "../_shared/delegation.ts";

interface DelegationWriteRequest {
  action: "create" | "revoke";
  electionId: string;
  sessionToken: string;
  ciphertext?: DelegationCiphertext;
  authorization?: DelegationAuthorization;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as DelegationWriteRequest;

    if (body.action !== "create" && body.action !== "revoke") {
      return errorResponse(400, "VALIDATION_ERROR", "Unsupported action");
    }

    if (
      typeof body.electionId !== "string" ||
      !body.electionId ||
      typeof body.sessionToken !== "string" ||
      !body.sessionToken
    ) {
      return errorResponse(400, "VALIDATION_ERROR", "Missing electionId or sessionToken");
    }

    const ct = body.ciphertext;
    if (body.action === "create" && (
      !ct?.c1 ||
      !ct.c2 ||
      !isCanonicalPrimeSubgroupPoint(ct.c1, false) ||
      !isCanonicalPrimeSubgroupPoint(ct.c2, false)
    )) {
      return errorResponse(400, "VALIDATION_ERROR", "Delegation ciphertext must contain canonical BabyJubJub prime-subgroup points");
    }

    const supabase = createServiceRoleClient();

    const session = await validateWorldIdSession(supabase, body.sessionToken);
    if (!session.valid || !session.userId) {
      return errorResponse(401, "SESSION_REQUIRED", session.detail || "Voter session validation failed");
    }

    const { data: participant, error: participantError } = await supabase
      .from("election_participants")
      .select("public_key_x, public_key_y")
      .eq("election_id", body.electionId)
      .eq("participant_id", session.userId)
      .maybeSingle();

    if (participantError) {
      console.error("Participant lookup error:", participantError);
      return errorResponse(500, "INTERNAL_ERROR", "Failed to load participant key");
    }

    if (!participant) {
      return errorResponse(409, "PARTICIPANT_REQUIRED", "Delegator is not a participant in this election");
    }

    const failure = await verifyDelegationAuthorization(
      body.authorization,
      { x: participant.public_key_x, y: participant.public_key_y },
      body.action,
      body.electionId,
      body.action === "create" ? ct : undefined
    );
    if (failure) {
      const message = failure === "EXPIRED"
        ? "Delegation authorization has expired"
        : failure === "FUTURE"
        ? "Delegation authorization timestamp is in the future"
        : "Delegation authorization signature is invalid";
      return errorResponse(failure === "MALFORMED" ? 400 : 401, "INVALID_SIGNATURE", message);
    }

    const { data: delegationId, error: writeError } = await supabase.rpc(
      "write_delegation_atomic",
      {
        p_action: body.action,
        p_election_id: body.electionId,
        p_delegator_id: session.userId,
        p_c1_x: body.action === "create" ? ct!.c1.x : null,
        p_c1_y: body.action === "create" ? ct!.c1.y : null,
        p_c2_x: body.action === "create" ? ct!.c2.x : null,
        p_c2_y: body.action === "create" ? ct!.c2.y : null,
        p_signature: body.authorization!.signature,
      }
    );

    if (writeError) {
      console.error("Atomic delegation write failed", writeError.code);
      if (writeError.message === "ELECTION_CLOSED") {
        return errorResponse(409, "ELECTION_CLOSED", "Election is closed");
      }
      if (writeError.message === "PARTICIPANT_REQUIRED") {
        return errorResponse(409, "PARTICIPANT_REQUIRED", "Delegator is not a participant in this election");
      }
      return errorResponse(500, "INTERNAL_ERROR", "Failed to update delegation");
    }

    return jsonResponse(200, { success: true, delegationId });
  } catch (error) {
    console.error("delegation-write error:", error);
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
  }
});
