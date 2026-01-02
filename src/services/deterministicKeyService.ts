/**
 * Deterministic Key Service - BabyJubJub key derivation from PRF output
 * 
 * This service derives BabyJubJub keypairs deterministically from the
 * passkey PRF output. The derivation is:
 * 
 *   S  = PRF(passkey, "votex:bjj:v1")      [from passkeyService]
 *   sk = SHA256(S || "babyjubjub") mod r   [this service]
 *   pk = sk * G                            [this service]
 * 
 * Security properties:
 * - sk is never stored, only derived on-demand
 * - Domain separation prevents key reuse across applications
 * - Reduction mod curve order ensures valid scalar
 */

import { EdwardsPoint } from "@/services/elGamalService";

// BabyJubJub subgroup order (for scalar reduction)
const CURVE_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;

// Domain separator for key derivation
const KEY_DERIVATION_DOMAIN = new TextEncoder().encode("babyjubjub");

export interface DerivedKeypair {
  sk: bigint;  // Private key - NEVER STORE THIS
  pk: {
    x: bigint;
    y: bigint;
  };
}

/**
 * Convert a bigint to 32-byte big-endian Uint8Array
 */
function bigintToBytes32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive BabyJubJub keypair from passkey PRF secret
 * 
 * Derivation: sk = SHA256(S || "babyjubjub") mod CURVE_ORDER
 *             pk = sk * G
 * 
 * @param prfSecret - 32-byte ArrayBuffer from passkey PRF
 * @returns The derived keypair (sk should not be stored!)
 */
export async function deriveKeypairFromSecret(prfSecret: ArrayBuffer): Promise<DerivedKeypair> {
  // Combine PRF secret with domain separator
  const secretBytes = new Uint8Array(prfSecret);
  const combined = new Uint8Array(secretBytes.length + KEY_DERIVATION_DOMAIN.length);
  combined.set(secretBytes, 0);
  combined.set(KEY_DERIVATION_DOMAIN, secretBytes.length);

  // Hash the combined value
  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  const hashBytes = new Uint8Array(hashBuffer);
  const hashHex = bytesToHex(hashBytes);

  // Reduce modulo curve order to get valid scalar
  const sk = BigInt("0x" + hashHex) % CURVE_ORDER;

  // Ensure sk is not zero (extremely unlikely but check anyway)
  if (sk === 0n) {
    throw new Error("Derived private key is zero - this should never happen");
  }

  // Compute public key: pk = sk * G
  const basePoint = EdwardsPoint.base();
  const pkPoint = basePoint.multiply(sk);

  // Verify the point is on curve
  if (!pkPoint.isOnCurve()) {
    throw new Error("Derived public key is not on curve - cryptographic error");
  }

  console.log("BabyJubJub keypair derived successfully");
  return {
    sk,
    pk: {
      x: pkPoint.x,
      y: pkPoint.y
    }
  };
}

/**
 * Hash the public key to create a signal for World ID binding
 * 
 * This creates a cryptographic commitment to the public key that is
 * included in the World ID proof. This binds the BabyJubJub identity
 * to the World ID proof, preventing key substitution attacks.
 * 
 * signal = SHA256(pk.x || pk.y)
 * 
 * @param pk - The public key (x, y coordinates)
 * @returns Hex string of the hash (with 0x prefix for World ID)
 */
export async function hashPublicKeyForSignal(pk: { x: bigint; y: bigint }): Promise<string> {
  // Pack public key coordinates as 32-byte big-endian values
  const pkBytes = new Uint8Array(64);
  const xBytes = bigintToBytes32(pk.x);
  const yBytes = bigintToBytes32(pk.y);
  pkBytes.set(xBytes, 0);
  pkBytes.set(yBytes, 32);

  // Hash to create signal
  const hashBuffer = await crypto.subtle.digest("SHA-256", pkBytes);
  const hashBytes = new Uint8Array(hashBuffer);
  const hashHex = bytesToHex(hashBytes);

  // Return with 0x prefix for World ID compatibility
  return "0x" + hashHex;
}

/**
 * Verify that a keypair is consistent (pk = sk * G)
 * 
 * This is useful for sanity checking derived keypairs.
 * 
 * @param keypair - The keypair to verify
 * @returns true if pk = sk * G
 */
export function verifyDerivedKeypair(keypair: DerivedKeypair): boolean {
  try {
    const basePoint = EdwardsPoint.base();
    const expectedPk = basePoint.multiply(keypair.sk);
    
    return expectedPk.x === keypair.pk.x && expectedPk.y === keypair.pk.y;
  } catch {
    return false;
  }
}

/**
 * Convert public key to string format for storage/display
 */
export function publicKeyToStrings(pk: { x: bigint; y: bigint }): { x: string; y: string } {
  return {
    x: pk.x.toString(),
    y: pk.y.toString()
  };
}

/**
 * Convert string format back to bigint public key
 */
export function stringsToPublicKey(pk: { x: string; y: string }): { x: bigint; y: bigint } {
  return {
    x: BigInt(pk.x),
    y: BigInt(pk.y)
  };
}
