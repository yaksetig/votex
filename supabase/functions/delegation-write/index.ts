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

    if (body.action === "revoke") {
      const { error: revokeError } = await supabase
        .from("delegations")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
        })
        .eq("election_id", body.electionId)
        .eq("delegator_id", session.userId)
        .eq("status", "active");

      if (revokeError) {
        console.error("Delegation revoke error:", revokeError);
        return jsonResponse(500, { error: "Failed to revoke delegation" });
      }

      return jsonResponse(200, { success: true });
    }

    const ct = body.ciphertext;
    if (
      !isDecimalString(ct?.c1?.x) || !isDecimalString(ct?.c1?.y) ||
      !isDecimalString(ct?.c2?.x) || !isDecimalString(ct?.c2?.y)
    ) {
      return jsonResponse(400, { error: "Missing or malformed delegation ciphertext" });
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, end_date, closed_manually_at")
      .eq("id", body.electionId)
      .maybeSingle();

    if (electionError) {
      console.error("Election lookup error:", electionError);
      return jsonResponse(500, { error: "Failed to load election" });
    }

    if (!election) {
      return jsonResponse(404, { error: "Election not found" });
    }

    if (
      election.closed_manually_at ||
      new Date(election.end_date).getTime() <= Date.now()
    ) {
      return jsonResponse(409, { error: "Election is closed" });
    }

    const { data: participant, error: participantError } = await supabase
      .from("election_participants")
      .select("id")
      .eq("election_id", body.electionId)
      .eq("participant_id", session.userId)
      .maybeSingle();

    if (participantError) {
      console.error("Participant lookup error:", participantError);
      return jsonResponse(500, { error: "Failed to check participant status" });
    }

    if (!participant) {
      return jsonResponse(409, {
        error: "Delegator is not a participant in this election",
      });
    }

    const { error: insertError } = await supabase.from("delegations").insert({
      election_id: body.electionId,
      delegator_id: session.userId,
      delegate_ct_c1_x: ct.c1.x,
      delegate_ct_c1_y: ct.c1.y,
      delegate_ct_c2_x: ct.c2.x,
      delegate_ct_c2_y: ct.c2.y,
    });

    if (insertError) {
      // 23505 = unique violation on the one-active-delegation index
      if (insertError.code === "23505") {
        return jsonResponse(409, {
          error: "An active delegation already exists for this election",
        });
      }

      console.error("Delegation insert error:", insertError);
      return jsonResponse(500, { error: "Failed to create delegation" });
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error("delegation-write error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
