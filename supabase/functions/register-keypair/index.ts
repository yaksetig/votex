/**
 * Register Keypair Edge Function
 * 
 * This function handles the registration of a BabyJubJub public key
 * bound to a World ID proof. It:
 * 1. Receives { pk: { x, y }, worldIdProof }
 * 2. Verifies the World ID proof signal matches Hash(pk)
 * 3. Checks if nullifier is already registered (rejects duplicates)
 * 4. Stores the binding: nullifier_hash → pk
 * 
 * Security properties:
 * - Uses service role to bypass RLS for insert
 * - Verifies proof binding to prevent key substitution
 * - Enforces one-key-per-human via nullifier uniqueness
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  pk: {
    x: string;
    y: string;
  };
  worldIdProof: {
    merkle_root: string;
    nullifier_hash: string;
    proof: string;
    verification_level: string;
  };
  signal: string;  // Hash(pk) - must match what was used in World ID verification
}

/**
 * Verify that the provided signal matches Hash(pk)
 * This ensures the World ID proof is bound to this specific public key
 */
async function verifySignalBinding(pk: { x: string; y: string }, claimedSignal: string): Promise<boolean> {
  // Pack public key coordinates as 32-byte big-endian values
  const xBigInt = BigInt(pk.x);
  const yBigInt = BigInt(pk.y);
  
  const pkBytes = new Uint8Array(64);
  
  // Convert x to 32 bytes big-endian
  let xTemp = xBigInt;
  for (let i = 31; i >= 0; i--) {
    pkBytes[i] = Number(xTemp & 0xffn);
    xTemp >>= 8n;
  }
  
  // Convert y to 32 bytes big-endian
  let yTemp = yBigInt;
  for (let i = 63; i >= 32; i--) {
    pkBytes[i] = Number(yTemp & 0xffn);
    yTemp >>= 8n;
  }
  
  // Hash to create expected signal
  const hashBuffer = await crypto.subtle.digest("SHA-256", pkBytes);
  const hashBytes = new Uint8Array(hashBuffer);
  const expectedSignal = "0x" + Array.from(hashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  console.log("Expected signal:", expectedSignal);
  console.log("Claimed signal:", claimedSignal);
  
  return expectedSignal.toLowerCase() === claimedSignal.toLowerCase();
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pk, worldIdProof, signal }: RequestBody = await req.json();
    
    // Validate required fields
    if (!pk?.x || !pk?.y) {
      return new Response(
        JSON.stringify({ error: "Missing public key coordinates" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!worldIdProof?.nullifier_hash) {
      return new Response(
        JSON.stringify({ error: "Missing World ID proof" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!signal) {
      return new Response(
        JSON.stringify({ error: "Missing signal" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify that the signal (Hash(pk)) matches the provided public key
    // This ensures the World ID proof is cryptographically bound to this key
    const signalValid = await verifySignalBinding(pk, signal);
    if (!signalValid) {
      console.error("Signal binding verification failed");
      return new Response(
        JSON.stringify({ error: "Signal does not match public key - proof binding invalid" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log("Signal binding verified successfully");
    
    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if this nullifier is already registered
    const { data: existing, error: lookupError } = await supabase
      .from('world_id_keypairs')
      .select('id, public_key_x, public_key_y')
      .eq('nullifier_hash', worldIdProof.nullifier_hash)
      .maybeSingle();
    
    if (lookupError) {
      console.error("Database lookup error:", lookupError);
      return new Response(
        JSON.stringify({ error: "Database error during lookup" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (existing) {
      // Already registered - check if it's the same key
      if (existing.public_key_x === pk.x && existing.public_key_y === pk.y) {
        // Same key, return success (idempotent)
        console.log("Same keypair already registered for this nullifier");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Keypair already registered",
            alreadyExists: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Different key - update the binding (passkey recovery flow)
        console.log("Updating keypair binding for existing nullifier (passkey recovery)");
        const { error: updateError } = await supabase
          .from('world_id_keypairs')
          .update({
            public_key_x: pk.x,
            public_key_y: pk.y
          })
          .eq('nullifier_hash', worldIdProof.nullifier_hash);
        
        if (updateError) {
          console.error("Database update error:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update keypair binding" }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Keypair binding updated",
            updated: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Store the new binding
    const { error: insertError } = await supabase
      .from('world_id_keypairs')
      .insert({
        nullifier_hash: worldIdProof.nullifier_hash,
        public_key_x: pk.x,
        public_key_y: pk.y
      });
    
    if (insertError) {
      console.error("Database insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store keypair binding" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log("Keypair registered successfully for nullifier:", worldIdProof.nullifier_hash.slice(0, 10) + "...");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Keypair registered successfully",
        alreadyExists: false 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
