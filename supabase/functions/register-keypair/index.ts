/**
 * Register Keypair Edge Function
 *
 * Binds a World ID nullifier to a passkey-derived BabyJubJub public key.
 * All request validation and the binding logic live in ./handler.ts so they
 * can be tested without a network; this file wires the real World ID API,
 * the keccak signal-hash helper, and the service-role client.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";
import { keccak256 } from "https://esm.sh/viem@2.26.2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  handleRegisterKeypair,
  interpretWorldIdVerifyResponse,
  type IDKitResult,
  type RegisterKeypairRequest,
  type WorldIdV4VerifyResponse,
} from "./handler.ts";

const WORLD_ID_RP_ID = Deno.env.get("WORLD_ID_RP_ID") ?? "rp_b3b4b36db636df22";
const WORLD_ID_VERIFY_BASE_URL =
  Deno.env.get("WORLD_ID_VERIFY_BASE_URL") ?? "https://developer.world.org";

function encodeUtf8ToHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** World ID signal_hash convention: keccak256(signal) >> 8, zero-padded. */
function computeSignalHash(signal: string): string {
  const encodedSignal =
    signal.startsWith("0x") && signal.length % 2 === 0
      ? signal
      : encodeUtf8ToHex(signal);

  const hashed = BigInt(keccak256(encodedSignal as `0x${string}`)) >> 8n;
  return `0x${hashed.toString(16).padStart(64, "0")}`;
}

async function verifyWorldIdProofV4(idkitResult: IDKitResult) {
  const response = await fetch(`${WORLD_ID_VERIFY_BASE_URL}/api/v4/verify/${WORLD_ID_RP_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(idkitResult),
  });

  let payload: WorldIdV4VerifyResponse | null = null;
  try {
    payload = (await response.json()) as WorldIdV4VerifyResponse;
  } catch {
    payload = null;
  }

  return interpretWorldIdVerifyResponse(response.ok, payload);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RegisterKeypairRequest;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    return await handleRegisterKeypair(
      { supabase, verifyWorldIdProof: verifyWorldIdProofV4, computeSignalHash },
      body
    );
  } catch (error) {
    console.error("register-keypair error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
