/**
 * RP Signature Edge Function
 *
 * Generates signed RP context for World ID v4 proof requests.
 * Implements the signing algorithm from @worldcoin/idkit-server natively
 * to avoid esm.sh bundling issues in Supabase Edge Functions.
 */

import { secp256k1 } from "https://esm.sh/@noble/curves@1.8.2/secp256k1";
import { keccak_256 } from "https://esm.sh/@noble/hashes@1.8.0/sha3";
import { bytesToHex, hexToBytes, concatBytes } from "https://esm.sh/@noble/hashes@1.8.0/utils";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_TTL_SEC = 300;
const RP_SIGNATURE_MSG_VERSION = 1;
const ETHEREUM_MESSAGE_PREFIX = "Ethereum Signed Message:\n";
const textEncoder = new TextEncoder();

/** Hash input to a 32-byte field element (keccak256 >> 8) */
function hashToField(input: Uint8Array): Uint8Array {
  const hash = BigInt("0x" + bytesToHex(keccak_256(input))) >> 8n;
  return hexToBytes(hash.toString(16).padStart(64, "0"));
}

/** Compute the RP signature message bytes */
function computeRpSignatureMessage(
  nonceBytes: Uint8Array,
  createdAt: number,
  expiresAt: number,
  action?: string
): Uint8Array {
  const actionBytes = action === undefined ? undefined : hashToField(textEncoder.encode(action));
  const message = new Uint8Array(49 + (actionBytes?.length ?? 0));
  message[0] = RP_SIGNATURE_MSG_VERSION;
  message.set(nonceBytes, 1);
  const view = new DataView(message.buffer);
  view.setBigUint64(33, BigInt(createdAt), false);
  view.setBigUint64(41, BigInt(expiresAt), false);
  if (actionBytes) {
    message.set(actionBytes, 49);
  }
  return message;
}

/** Hash with Ethereum signed message prefix */
function hashEthereumMessage(message: Uint8Array): Uint8Array {
  const prefix = textEncoder.encode(`${ETHEREUM_MESSAGE_PREFIX}${message.length}`);
  return keccak_256(concatBytes(prefix, message));
}

/** Sign the RP request — equivalent to @worldcoin/idkit-server signRequest */
function signRequest(params: { signingKeyHex: string; action: string; ttl?: number }) {
  const { action, signingKeyHex, ttl = DEFAULT_TTL_SEC } = params;
  const keyHex = signingKeyHex.startsWith("0x") ? signingKeyHex.slice(2) : signingKeyHex;
  const privKey = hexToBytes(keyHex);

  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonceBytes = hashToField(randomBytes);
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + ttl;

  const message = computeRpSignatureMessage(nonceBytes, createdAt, expiresAt, action);
  const msgHash = hashEthereumMessage(message);
  const recSig = secp256k1.sign(msgHash, privKey);
  const compact = recSig.toCompactRawBytes();
  const sig65 = new Uint8Array(65);
  sig65.set(compact, 0);
  sig65[64] = recSig.recovery + 27;

  return {
    sig: "0x" + bytesToHex(sig65),
    nonce: "0x" + bytesToHex(nonceBytes),
    createdAt,
    expiresAt,
  };
}

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
