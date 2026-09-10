/**
 * Deterministic Key Service - passkey PRF to EdDSA/BabyJubJub key material
 *
 * This service derives a vetted EdDSA seed from the passkey PRF output,
 * then derives both:
 *
 *   seed = HKDF-SHA256(PRF, "votex:eddsa:passkey-seed:v1")
 *   pk   = circomlibjs EdDSA public key from seed
 *   sk   = EdDSA-compatible subgroup scalar used by the existing ZK/ElGamal flow
 *
 * Security properties:
 * - the seed is derived deterministically from the passkey secret
 * - signatures use circomlibjs EdDSA-Poseidon
 * - Domain separation prevents key reuse across applications
 * - the scalar remains compatible with the existing BabyJubJub encryption circuits
 */

import { EdwardsPoint } from "@/services/elGamalService";
import { logger } from "@/services/logger";
import {
  deriveKeyMaterialFromSeed,
  deriveSeedFromPasskeySecret,
} from "@/services/eddsaService";

export interface DerivedKeypair {
  seed: Uint8Array;
  seedHex: string;
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
  const seed = await deriveSeedFromPasskeySecret(prfSecret);
  const keyMaterial = await deriveKeyMaterialFromSeed(seed);

  logger.debug("Passkey-backed EdDSA keypair derived successfully");
  return {
    seed: keyMaterial.seed,
    seedHex: keyMaterial.seedHex,
    sk: keyMaterial.scalar,
    pk: {
      x: keyMaterial.publicKey.x,
      y: keyMaterial.publicKey.y,
    },
  };
}

/**
 * Hash the public key to create a signal for World ID binding. The format is
 * defined once in @protocol and shared with register-keypair.
 */
export { hashPublicKeyForSignal } from "@protocol";

/**
 * Verify that a keypair is consistent (pk = sk * G)
 */
export function verifyDerivedKeypair(keypair: DerivedKeypair): boolean {
  try {
    const basePoint = EdwardsPoint.base();
    const expectedPk = basePoint.multiply(keypair.sk);

    return (
      expectedPk.x === keypair.pk.x &&
      expectedPk.y === keypair.pk.y &&
      keypair.sk > 0n
    );
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
