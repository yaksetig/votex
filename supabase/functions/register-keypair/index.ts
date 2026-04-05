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
import { keccak256 } from "https://esm.sh/viem@2.26.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WORLD_ID_APP_ID =
  Deno.env.get("WORLD_ID_APP_ID") ?? "app_e2fd2f8c99430ab200a093278e801c57";
const WORLD_ID_VERIFY_BASE_URL =
  Deno.env.get("WORLD_ID_VERIFY_BASE_URL") ?? "https://developer.world.org";

interface RequestBody {
  action?: string;
  bindingOperation?: "register" | "recover";
  pk: {
    x: string;
    y: string;
  };
  sessionToken?: string;
  verifierHash?: string;
  worldIdProof: {
    merkle_root: string;
    nullifier_hash: string;
    proof: string;
    verification_level: string;
  };
  signal: string;  // Hash(pk) - must match what was used in World ID verification
}

interface WorldIdVerifyResponse {
  success: boolean;
  action?: string;
  nullifier_hash?: string;
  detail?: string;
  code?: string;
}

interface RecoverySessionValidationResult {
  valid: boolean;
  detail?: string;
}

function encodeUtf8ToHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function computeSignalHash(signal: string): string {
  const encodedSignal =
    signal.startsWith("0x") && signal.length % 2 === 0
      ? signal
      : encodeUtf8ToHex(signal);

  const hashed = BigInt(keccak256(encodedSignal)) >> 8n;
  return `0x${hashed.toString(16).padStart(64, "0")}`;
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

async function verifyWorldIdProof(
  worldIdProof: RequestBody["worldIdProof"],
  action: string,
  signal: string
): Promise<{ valid: boolean; detail?: string }> {
  const response = await fetch(`${WORLD_ID_VERIFY_BASE_URL}/api/v2/verify/${WORLD_ID_APP_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      merkle_root: worldIdProof.merkle_root,
      nullifier_hash: worldIdProof.nullifier_hash,
      proof: worldIdProof.proof,
      signal_hash: computeSignalHash(signal),
      verification_level: worldIdProof.verification_level,
    }),
  });

  let payload: WorldIdVerifyResponse | null = null;
  try {
    payload = (await response.json()) as WorldIdVerifyResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      valid: false,
      detail: payload?.detail || payload?.code || "World ID verification request failed",
    };
  }

  if (!payload?.success) {
    return {
      valid: false,
      detail: payload?.detail || payload?.code || "World ID proof was rejected",
    };
  }

  if (payload.action !== action) {
    return {
      valid: false,
      detail: "Verified proof action did not match the expected action",
    };
  }

  if (payload.nullifier_hash !== worldIdProof.nullifier_hash) {
    return {
      valid: false,
      detail: "Verified proof nullifier did not match the submitted proof",
    };
  }

  return { valid: true };
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function validateRecoverySession(
  supabase: ReturnType<typeof createClient>,
  sessionToken: string,
  nullifierHash: string
): Promise<RecoverySessionValidationResult> {
  const tokenHash = await sha256Hex(sessionToken);
  const { data: session, error: sessionError } = await supabase
    .from("world_id_sessions")
    .select("expires_at, nullifier_hash, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError) {
    console.error("Recovery session lookup error:", sessionError);
    return { valid: false, detail: "Failed to validate recovery session" };
  }

  if (!session || session.revoked_at) {
    return { valid: false, detail: "Recovery session is invalid or revoked" };
  }

  if (session.nullifier_hash !== nullifierHash) {
    return {
      valid: false,
      detail: "Recovery session does not belong to the verified identity",
    };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("world_id_sessions")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);

    return { valid: false, detail: "Recovery session has expired" };
  }

  return { valid: true };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      action = "registration",
      bindingOperation = "register",
      pk,
      sessionToken,
      verifierHash,
      worldIdProof,
      signal,
    }: RequestBody = await req.json();
    
    // Validate required fields
    if (!pk?.x || !pk?.y) {
      return new Response(
        JSON.stringify({ error: "Missing public key coordinates" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!worldIdProof?.nullifier_hash || !worldIdProof?.merkle_root || !worldIdProof?.proof || !worldIdProof?.verification_level) {
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

    const verification = await verifyWorldIdProof(worldIdProof, action, signal);
    if (!verification.valid) {
      console.error("World ID proof verification failed:", verification.detail);
      return new Response(
        JSON.stringify({ error: verification.detail || "World ID proof verification failed" }),
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

        if (verifierHash) {
          const { error: verifierUpsertError } = await supabase
            .from('world_id_auth_verifiers')
            .upsert({
              nullifier_hash: worldIdProof.nullifier_hash,
              verifier_hash: verifierHash
            });

          if (verifierUpsertError) {
            console.error("Verifier upsert error:", verifierUpsertError);
            return new Response(
              JSON.stringify({ error: "Failed to store session verifier" }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Keypair already registered",
            alreadyExists: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        if (bindingOperation !== "recover") {
          return new Response(
            JSON.stringify({
              error:
                "A keypair is already bound to this identity. Use the explicit recovery flow to rebind it.",
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!sessionToken) {
          return new Response(
            JSON.stringify({
              error: "Recovery requires a valid session token for the verified identity",
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!verifierHash) {
          return new Response(
            JSON.stringify({
              error: "Recovery requires a verifier hash for the replacement passkey",
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const recoverySession = await validateRecoverySession(
          supabase,
          sessionToken,
          worldIdProof.nullifier_hash
        );

        if (!recoverySession.valid) {
          return new Response(
            JSON.stringify({
              error: recoverySession.detail || "Recovery session validation failed",
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log("Updating keypair binding for existing nullifier via explicit recovery flow");
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

        if (verifierHash) {
          const { error: verifierUpsertError } = await supabase
            .from('world_id_auth_verifiers')
            .upsert({
              nullifier_hash: worldIdProof.nullifier_hash,
              verifier_hash: verifierHash
            });

          if (verifierUpsertError) {
            console.error("Verifier upsert error:", verifierUpsertError);
            return new Response(
              JSON.stringify({ error: "Failed to store session verifier" }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        await supabase
          .from("world_id_sessions")
          .update({
            revoked_at: new Date().toISOString(),
          })
          .eq("nullifier_hash", worldIdProof.nullifier_hash)
          .is("revoked_at", null);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Keypair binding updated",
            updated: true,
            recovery: true,
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

    if (verifierHash) {
      const { error: verifierInsertError } = await supabase
        .from('world_id_auth_verifiers')
        .upsert({
          nullifier_hash: worldIdProof.nullifier_hash,
          verifier_hash: verifierHash
        });

      if (verifierInsertError) {
        console.error("Verifier insert error:", verifierInsertError);
        return new Response(
          JSON.stringify({ error: "Failed to store session verifier" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
