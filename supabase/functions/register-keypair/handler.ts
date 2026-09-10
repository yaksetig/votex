// Request handling for register-keypair, extracted so it can be unit-tested
// with a fake supabase client and a fake World ID verifier (no network).
//
// Binding model:
//   1. The World ID v4 proof is verified by the World ID API. The API response
//      (not the client payload) is the source of truth for success and for the
//      nullifier that gets bound.
//   2. The proof's signal_hash must commit to Hash(pk), and Hash(pk) must
//      match the submitted public key, so the human is bound to this key.
//   3. The caller must prove possession of the key's private scalar with an
//      EdDSA-Poseidon signature over a fresh, domain-separated message that
//      names the nullifier and the key. Without this, anyone holding a proof
//      for their own World ID could register (and later lock out) someone
//      else's public key.
//   4. The session verifier is stored hashed; the plaintext value is a bearer
//      credential and never touches the database.

import { jsonResponse, sha256Hex } from "../_shared/http.ts";
import { isCanonicalPrimeSubgroupPoint } from "../_shared/babyjub.ts";
import { verifyPoseidonSignature } from "../_shared/eddsa.ts";
import {
  buildRegistrationOwnershipMessage,
  checkProofFreshness,
  hashPublicKeyForSignal,
} from "../_shared/protocol.ts";

export const WORLD_ID_ACTION = "registration";
export const WORLD_ID_ENVIRONMENT = "production";

const VERIFIER_HASH_PATTERN = /^[0-9a-f]{64}$/;
const HEX32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/** v4 IDKit response format, as forwarded by the browser widget. */
export interface IDKitResult {
  protocol_version: string;
  nonce: string;
  action: string;
  environment: string;
  responses: Array<{
    identifier: string;
    signal_hash: string;
    proof: string | string[];
    merkle_root?: string;
    nullifier: string;
  }>;
}

export interface OwnershipProof {
  issuedAt: number;
  signature: string;
}

export interface RegisterKeypairRequest {
  pk: { x: string; y: string };
  signal: string;
  verifierHash: string;
  idkitResult: IDKitResult;
  ownershipProof: OwnershipProof;
}

/** Shape of the World ID v4 verify response we depend on. */
export interface WorldIdV4VerifyResponse {
  success?: boolean;
  action?: string;
  nullifier?: string;
  code?: string;
  detail?: string;
  results?: Array<{
    identifier?: string;
    success?: boolean;
    nullifier?: string;
    code?: string;
    detail?: string;
  }>;
}

export interface WorldIdVerification {
  valid: boolean;
  nullifier?: string;
  detail?: string;
}

export type WorldIdVerifier = (idkitResult: IDKitResult) => Promise<WorldIdVerification>;

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface RegisterKeypairDeps {
  supabase: SupabaseClient;
  verifyWorldIdProof: WorldIdVerifier;
  computeSignalHash: (signal: string) => string;
  now?: () => number;
}

/**
 * Interpret a World ID v4 verify response strictly: HTTP 200 alone is not
 * success. Exactly one response must have been verified, and the nullifier
 * reported by the API is the one that gets bound.
 */
export function interpretWorldIdVerifyResponse(
  ok: boolean,
  payload: WorldIdV4VerifyResponse | null
): WorldIdVerification {
  if (!ok) {
    return {
      valid: false,
      detail: payload?.detail || payload?.code || "World ID v4 verification request failed",
    };
  }

  if (!payload || payload.success !== true) {
    return { valid: false, detail: payload?.detail || "World ID verification did not succeed" };
  }

  if (payload.action !== undefined && payload.action !== WORLD_ID_ACTION) {
    return { valid: false, detail: "World ID verification action mismatch" };
  }

  const results = Array.isArray(payload.results) ? payload.results : [];
  if (results.length !== 1 || results[0].success !== true) {
    return { valid: false, detail: "World ID verification must succeed for exactly one response" };
  }

  const nullifier = results[0].nullifier ?? payload.nullifier;
  if (typeof nullifier !== "string" || !HEX32_PATTERN.test(nullifier)) {
    return { valid: false, detail: "World ID verification returned no usable nullifier" };
  }

  return { valid: true, nullifier };
}

/** The claimed signal must be Hash(pk) for the submitted key. */
export async function verifySignalBinding(
  pk: { x: string; y: string },
  claimedSignal: string
): Promise<boolean> {
  return (await hashPublicKeyForSignal(pk)) === claimedSignal.toLowerCase();
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function handleRegisterKeypair(
  deps: RegisterKeypairDeps,
  body: RegisterKeypairRequest
): Promise<Response> {
  const now = deps.now ?? Date.now;
  const { pk, signal, verifierHash, idkitResult, ownershipProof } = body ?? ({} as RegisterKeypairRequest);

  // --- Local shape validation, before any database or network work ---
  if (!pk || !isString(pk.x) || !isString(pk.y)) {
    return jsonResponse(400, { error: "Missing public key coordinates" });
  }
  if (!isCanonicalPrimeSubgroupPoint(pk, false)) {
    return jsonResponse(400, { error: "Public key is not a canonical BabyJubJub subgroup point" });
  }
  if (!isString(signal) || !HEX32_PATTERN.test(signal)) {
    return jsonResponse(400, { error: "Missing or malformed signal" });
  }
  if (!isString(verifierHash) || !VERIFIER_HASH_PATTERN.test(verifierHash)) {
    return jsonResponse(400, { error: "Missing or malformed session verifier" });
  }
  if (
    !ownershipProof ||
    !isString(ownershipProof.signature) ||
    ownershipProof.signature.length > 2048
  ) {
    return jsonResponse(400, { error: "Missing key ownership proof" });
  }
  if (
    !idkitResult ||
    !Array.isArray(idkitResult.responses) ||
    idkitResult.responses.length !== 1 ||
    !isString(idkitResult.responses[0]?.nullifier) ||
    !isString(idkitResult.responses[0]?.signal_hash)
  ) {
    return jsonResponse(400, { error: "IDKit result must contain exactly one response" });
  }
  if (idkitResult.action !== WORLD_ID_ACTION) {
    return jsonResponse(400, { error: "Unsupported World ID action" });
  }

  const freshness = checkProofFreshness(ownershipProof.issuedAt, now());
  if (freshness) {
    return jsonResponse(400, {
      error: freshness === "EXPIRED"
        ? "Key ownership proof has expired"
        : freshness === "FUTURE"
        ? "Key ownership proof timestamp is in the future"
        : "Missing key ownership proof",
    });
  }

  // The proof's signal_hash must commit to the claimed signal, and the claimed
  // signal must be Hash(pk). Together they bind the World ID proof to this key.
  if (idkitResult.responses[0].signal_hash !== deps.computeSignalHash(signal)) {
    return jsonResponse(400, { error: "Proof signal_hash does not match the claimed signal" });
  }
  if (!(await verifySignalBinding(pk, signal))) {
    return jsonResponse(400, { error: "Signal does not match public key - proof binding invalid" });
  }

  // --- World ID verification (server-pinned action/environment) ---
  const verification = await deps.verifyWorldIdProof({
    protocol_version: idkitResult.protocol_version,
    nonce: idkitResult.nonce,
    action: WORLD_ID_ACTION,
    environment: WORLD_ID_ENVIRONMENT,
    responses: idkitResult.responses,
  });
  if (!verification.valid || !verification.nullifier) {
    console.error("World ID v4 proof verification failed:", verification.detail);
    return jsonResponse(400, { error: verification.detail || "World ID proof verification failed" });
  }

  const nullifier = verification.nullifier;
  if (nullifier.toLowerCase() !== idkitResult.responses[0].nullifier.toLowerCase()) {
    return jsonResponse(400, { error: "World ID nullifier does not match the submitted proof" });
  }

  // --- Proof of possession of the private key ---
  const expectedMessage = buildRegistrationOwnershipMessage(nullifier, pk, ownershipProof.issuedAt);
  let ownershipValid = false;
  try {
    ownershipValid = await verifyPoseidonSignature(ownershipProof.signature, pk, expectedMessage);
  } catch {
    ownershipValid = false;
  }
  if (!ownershipValid) {
    return jsonResponse(400, { error: "Key ownership proof is invalid" });
  }

  const hashedVerifier = await sha256Hex(verifierHash);
  const supabase = deps.supabase;

  const { data: existing, error: lookupError } = await supabase
    .from("world_id_keypairs")
    .select("id, public_key_x, public_key_y")
    .eq("nullifier_hash", nullifier)
    .maybeSingle();

  if (lookupError) {
    console.error("Database lookup error:", lookupError);
    return jsonResponse(500, { error: "Database error during lookup" });
  }

  if (existing) {
    if (existing.public_key_x !== pk.x || existing.public_key_y !== pk.y) {
      return jsonResponse(409, {
        code: "KEYPAIR_ALREADY_BOUND",
        error: "A different voting key is already bound to this World ID. Use the original Votex passkey.",
      });
    }

    const { error: verifierUpsertError } = await supabase
      .from("world_id_auth_verifiers")
      .upsert({ nullifier_hash: nullifier, verifier_hash: hashedVerifier });
    if (verifierUpsertError) {
      console.error("Verifier upsert error:", verifierUpsertError);
      return jsonResponse(500, { error: "Failed to store session verifier" });
    }

    return jsonResponse(200, {
      success: true,
      message: "Keypair already registered",
      alreadyExists: true,
    });
  }

  const { error: insertError } = await supabase
    .from("world_id_keypairs")
    .insert({ nullifier_hash: nullifier, public_key_x: pk.x, public_key_y: pk.y });

  if (insertError) {
    // A unique violation on (public_key_x, public_key_y) means this exact key
    // is already bound to a different World ID; possession was proven, so the
    // most likely cause is the same passkey being used by two identities.
    if (insertError.code === "23505") {
      return jsonResponse(409, {
        code: "PUBLIC_KEY_ALREADY_BOUND",
        error: "This voting key is already bound to another World ID.",
      });
    }
    console.error("Database insert error:", insertError);
    return jsonResponse(500, { error: "Failed to store keypair binding" });
  }

  const { error: verifierInsertError } = await supabase
    .from("world_id_auth_verifiers")
    .upsert({ nullifier_hash: nullifier, verifier_hash: hashedVerifier });
  if (verifierInsertError) {
    console.error("Verifier insert error:", verifierInsertError);
    return jsonResponse(500, { error: "Failed to store session verifier" });
  }

  return jsonResponse(200, {
    success: true,
    message: "Keypair registered successfully",
    alreadyExists: false,
  });
}
