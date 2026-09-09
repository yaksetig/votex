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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
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
      return jsonResponse(400, { error: "Unsupported action" });
    }

    if (
      typeof body.electionId !== "string" ||
      !body.electionId ||
      typeof body.sessionToken !== "string" ||
      !body.sessionToken
    ) {
      return jsonResponse(400, { error: "Missing electionId or sessionToken" });
    }

    const ct = body.ciphertext;
    if (body.action === "create" && (
      !ct?.c1 ||
      !ct.c2 ||
      !isCanonicalPrimeSubgroupPoint(ct.c1, false) ||
      !isCanonicalPrimeSubgroupPoint(ct.c2, false)
    )) {
      return jsonResponse(400, {
        error: "Delegation ciphertext must contain canonical BabyJubJub prime-subgroup points",
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

    const { data: participant, error: participantError } = await supabase
      .from("election_participants")
      .select("public_key_x, public_key_y")
      .eq("election_id", body.electionId)
      .eq("participant_id", session.userId)
      .maybeSingle();

    if (participantError) {
      console.error("Participant lookup error:", participantError);
      return jsonResponse(500, { error: "Failed to load participant key" });
    }

    if (!participant) {
      return jsonResponse(409, {
        code: "PARTICIPANT_REQUIRED",
        error: "Delegator is not a participant in this election",
      });
    }

    const failure = await verifyDelegationAuthorization(
      body.authorization,
      { x: participant.public_key_x, y: participant.public_key_y },
      body.action,
      body.electionId,
      body.action === "create" ? ct : undefined
    );
    if (failure) {
      return jsonResponse(failure === "MALFORMED" ? 400 : 401, {
        code: "INVALID_SIGNATURE",
        error: failure === "EXPIRED"
          ? "Delegation authorization has expired"
          : failure === "FUTURE"
          ? "Delegation authorization timestamp is in the future"
          : "Delegation authorization signature is invalid",
      });
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
      const code = writeError.message === "ELECTION_CLOSED"
        ? "ELECTION_CLOSED"
        : writeError.message === "PARTICIPANT_REQUIRED"
        ? "PARTICIPANT_REQUIRED"
        : "CONFLICT";
      return jsonResponse(code === "CONFLICT" ? 500 : 409, {
        code,
        error: writeError.message === "ELECTION_CLOSED"
          ? "Election is closed"
          : writeError.message === "PARTICIPANT_REQUIRED"
          ? "Delegator is not a participant in this election"
          : "Failed to update delegation",
      });
    }

    return jsonResponse(200, { success: true, delegationId });
  } catch (error) {
    console.error("delegation-write error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
