/**
 * RP Signature Edge Function
 *
 * Generates signed RP context for World ID v4 proof requests.
 * The signature proves the request originates from our app.
 */

import { signRequest } from "https://esm.sh/@worldcoin/idkit-server@4?bundle";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    const signingKeyHex = Deno.env.get("RP_SIGNING_KEY");

    if (!signingKeyHex) {
      console.error("RP_SIGNING_KEY not set");
      return new Response(
        JSON.stringify({ error: "RP signing key not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid action" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex,
      action,
    });

    return new Response(
      JSON.stringify({
        sig,
        nonce,
        created_at: createdAt,
        expires_at: expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("RP signature error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate RP signature" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
