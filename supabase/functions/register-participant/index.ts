// Registers the caller as a participant in an election.
//
// Replaces the direct client insert into election_participants (locked down in
// 20260611100000). The submitted public key must match the caller's registered
// world_id_keypairs binding, which prevents both key substitution and
// registration on behalf of another voter.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";

interface RegisterParticipantRequest {
  electionId: string;
  sessionToken: string;
  publicKey: { x: string; y: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RegisterParticipantRequest;

    if (!body.electionId || !body.sessionToken || !body.publicKey?.x || !body.publicKey?.y) {
      return jsonResponse(400, {
        error: "Missing electionId, sessionToken, or publicKey",
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

    const { data: keypair, error: keypairError } = await supabase
      .from("world_id_keypairs")
      .select("public_key_x, public_key_y")
      .eq("nullifier_hash", session.userId)
      .maybeSingle();

    if (keypairError) {
      console.error("Keypair lookup error:", keypairError);
      return jsonResponse(500, { error: "Failed to load registered keypair" });
    }

    if (!keypair) {
      return jsonResponse(409, {
        error: "No registered keypair exists for this identity",
      });
    }

    if (
      keypair.public_key_x !== body.publicKey.x ||
      keypair.public_key_y !== body.publicKey.y
    ) {
      return jsonResponse(409, {
        error:
          "Submitted public key does not match the registered keypair for this identity",
      });
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

    const { data: existing, error: existingError } = await supabase
      .from("election_participants")
      .select("id, public_key_x, public_key_y")
      .eq("election_id", body.electionId)
      .eq("participant_id", session.userId)
      .maybeSingle();

    if (existingError) {
      console.error("Participant lookup error:", existingError);
      return jsonResponse(500, { error: "Failed to check existing registration" });
    }

    if (existing) {
      if (
        existing.public_key_x === body.publicKey.x &&
        existing.public_key_y === body.publicKey.y
      ) {
        return jsonResponse(200, { success: true, alreadyRegistered: true });
      }

      return jsonResponse(409, {
        error:
          "This election already has a different key bound to your participant slot. " +
          "That looks like stale participant data from an older key flow. " +
          "Do not auto-update it from the client; reset the participant data and retry.",
      });
    }

    const { error: insertError } = await supabase
      .from("election_participants")
      .insert({
        election_id: body.electionId,
        participant_id: session.userId,
        public_key_x: body.publicKey.x,
        public_key_y: body.publicKey.y,
      });

    if (insertError) {
      console.error("Participant insert error:", insertError);
      return jsonResponse(500, { error: "Failed to register participant" });
    }

    return jsonResponse(200, { success: true, alreadyRegistered: false });
  } catch (error) {
    console.error("register-participant error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
