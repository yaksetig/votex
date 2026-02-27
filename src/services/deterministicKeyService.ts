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
import { CURVE_ORDER } from "@/services/crypto/constants";
import { toBytesBE, bytesToHex } from "@/services/crypto/utils";
import { logger } from "@/services/logger";

// Domain separator for key derivation
const KEY_DERIVATION_DOMAIN = new TextEncoder().encode("babyjubjub");

export interface DerivedKeypair {
  sk: bigint; // Private key - NEVER STORE THIS
  pk: {
    x: bigint;
    y: bigint;
  };
}

/**
 * Derive BabyJubJub keypair from passkey PRF secret
 */
export async function deriveKeypairFromSecret(
  prfSecret: ArrayBuffer
): Promise<DerivedKeypair> {
  const secretBytes = new Uint8Array(prfSecret);
  const combined = new Uint8Array(
    secretBytes.length + KEY_DERIVATION_DOMAIN.length
  );
  combined.set(secretBytes, 0);
  combined.set(KEY_DERIVATION_DOMAIN, secretBytes.length);

  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  const hashBytes = new Uint8Array(hashBuffer);
  const hashHex = bytesToHex(hashBytes);

  const sk = BigInt("0x" + hashHex) % CURVE_ORDER;

  if (sk === 0n) {
    throw new Error("Derived private key is zero - this should never happen");
  }

  const basePoint = EdwardsPoint.base();
  const pkPoint = basePoint.multiply(sk);

  if (!pkPoint.isOnCurve()) {
    throw new Error(
      "Derived public key is not on curve - cryptographic error"
    );
  }

  logger.debug("BabyJubJub keypair derived successfully");
  return {
    sk,
    pk: {
      x: pkPoint.x,
      y: pkPoint.y,
    },
  };
}

/**
 * Hash the public key to create a signal for World ID binding
 */
export async function hashPublicKeyForSignal(pk: {
  x: bigint;
  y: bigint;
}): Promise<string> {
  const pkBytes = new Uint8Array(64);
  const xBytes = toBytesBE(pk.x);
  const yBytes = toBytesBE(pk.y);
  pkBytes.set(xBytes, 0);
  pkBytes.set(yBytes, 32);

  const hashBuffer = await crypto.subtle.digest("SHA-256", pkBytes);
  const hashBytes = new Uint8Array(hashBuffer);
  const hashHex = bytesToHex(hashBytes);

  return "0x" + hashHex;
}

/**
 * Verify that a keypair is consistent (pk = sk * G)
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
export function publicKeyToStrings(pk: {
  x: bigint;
  y: bigint;
}): { x: string; y: string } {
  return {
    x: pk.x.toString(),
    y: pk.y.toString(),
  };
}

/**
 * Convert string format back to bigint public key
 */
export function stringsToPublicKey(pk: {
  x: string;
  y: string;
}): { x: bigint; y: bigint } {
  return {
    x: BigInt(pk.x),
    y: BigInt(pk.y),
  };
}
