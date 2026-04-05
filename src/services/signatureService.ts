/**
 * EdDSA-Poseidon Signature Service
 *
 * Implements EdDSA signatures over BabyJubJub using Poseidon hash,
 * the standard signature scheme in the circom/iden3 ecosystem.
 *
 * Signature scheme:
 *   r  = Poseidon(sk, msgField)           deterministic nonce
 *   R  = r * Base8                        nonce commitment
 *   h  = Poseidon(R.x, R.y, A.x, A.y, msgField)   challenge
 *   S  = (r + h * sk) mod subOrder        response
 *
 * Verification:
 *   h  = Poseidon(R.x, R.y, A.x, A.y, msgField)
 *   S * Base8 == R + h * A
 */

import { poseidon2, poseidon5 } from "poseidon-lite";
import { StoredKeypair } from "@/types/keypair";
import { CURVE_ORDER } from "@/services/crypto/constants";
import { EdwardsPoint } from "@/services/elGamalService";
import { logger } from "@/services/logger";

/**
 * Hash a message string to a field element via SHA-256 → mod CURVE_ORDER.
 */
async function hashMessageToField(message: string): Promise<bigint> {
  const bytes = new TextEncoder().encode(message);
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hashBytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < hashBytes.length; i++) {
    hex += hashBytes[i].toString(16).padStart(2, "0");
  }
  return BigInt("0x" + hex) % CURVE_ORDER;
}

/**
 * Sign a vote using EdDSA-Poseidon over BabyJubJub.
 */
export async function signVote(
  keypair: StoredKeypair,
  electionId: string,
  choice: string
): Promise<{
  signature: string;
  publicKey: { x: string; y: string };
  timestamp: number;
}> {
  const sk = BigInt(keypair.k);
  const Ax = BigInt(keypair.Ax);
  const Ay = BigInt(keypair.Ay);

  const timestamp = Date.now();
  const message = `${electionId}:${choice}:${timestamp}`;
  const msgField = await hashMessageToField(message);

  // Deterministic nonce: r = Poseidon(sk, msgField) mod subOrder
  const r = poseidon2([sk, msgField]) % CURVE_ORDER;

  // R = r * Base8
  const R = EdwardsPoint.base().multiply(r);

  // Challenge: h = Poseidon(R.x, R.y, A.x, A.y, msgField) mod subOrder
  const h = poseidon5([R.x, R.y, Ax, Ay, msgField]) % CURVE_ORDER;

  // Response: S = (r + h * sk) mod subOrder
  const S = (r + ((h * sk) % CURVE_ORDER)) % CURVE_ORDER;

  const signatureObject = {
    R8: { x: R.x.toString(), y: R.y.toString() },
    S: S.toString(),
    message,
  };

  return {
    signature: JSON.stringify(signatureObject),
    publicKey: { x: keypair.Ax, y: keypair.Ay },
    timestamp,
  };
}

/**
 * Verify an EdDSA-Poseidon signature.
 */
export async function verifySignature(
  signature: string,
  publicKey: { x: string; y: string }
): Promise<boolean> {
  try {
    const sigObj = JSON.parse(signature);
    const S = BigInt(sigObj.S);
    const Rx = BigInt(sigObj.R8.x);
    const Ry = BigInt(sigObj.R8.y);
    const message: string = sigObj.message;

    const Ax = BigInt(publicKey.x);
    const Ay = BigInt(publicKey.y);

    if (S < 0n || S >= CURVE_ORDER) {
      return false;
    }

    const R = new EdwardsPoint(Rx, Ry);
    const A = new EdwardsPoint(Ax, Ay);
    if (!R.isOnCurve() || !A.isOnCurve()) {
      return false;
    }

    const msgField = await hashMessageToField(message);

    // Recompute challenge: h = Poseidon(R.x, R.y, A.x, A.y, msgField)
    const h = poseidon5([Rx, Ry, Ax, Ay, msgField]) % CURVE_ORDER;

    // Verify: S * Base8 == R + h * A
    const lhs = EdwardsPoint.base().multiply(S);
    const rhs = R.add(A.multiply(h));

    return lhs.equals(rhs);
  } catch (error) {
    logger.error("EdDSA-Poseidon signature verification failed:", error);
    return false;
  }
}
