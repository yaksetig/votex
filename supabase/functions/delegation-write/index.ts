// Creates or revokes a vote delegation for the session holder.
//
// Replaces the direct client writes to delegations (locked down in
// 20260611100200). The delegator id always comes from the validated World ID
// session, never from the request body, so a delegation cannot be forged or
// revoked on behalf of another voter.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";

interface DelegationWriteRequest {
  action: "create" | "revoke";
  electionId: string;
  sessionToken: string;
  ciphertext?: {
    c1: { x: string; y: string };
    c2: { x: string; y: string };
  };
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]+$/.test(value);
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

    if (!body.electionId || !body.sessionToken) {
      return jsonResponse(400, { error: "Missing electionId or sessionToken" });
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

    const ct = body.ciphertext;
    if (body.action === "create" && (
      !isDecimalString(ct?.c1?.x) || !isDecimalString(ct?.c1?.y) ||
      !isDecimalString(ct?.c2?.x) || !isDecimalString(ct?.c2?.y)
    )) {
      return jsonResponse(400, { error: "Missing or malformed delegation ciphertext" });
    }

    const { data: delegationId, error: writeError } = await supabase.rpc(
      "write_delegation_atomic",
      {
        p_action: body.action,
        p_election_id: body.electionId,
        p_delegator_id: session.userId,
        p_c1_x: ct?.c1?.x ?? null,
        p_c1_y: ct?.c1?.y ?? null,
        p_c2_x: ct?.c2?.x ?? null,
        p_c2_y: ct?.c2?.y ?? null,
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
