/**
 * Authority Ownership Proof Service
 *
 * Generates an EdDSA-Poseidon signature proving ownership of a
 * BabyJubJub private key for authority linking.
 */

import { poseidon2, poseidon5 } from "poseidon-lite";
import { CURVE_ORDER } from "@/services/crypto/constants";
import { EdwardsPoint } from "@/services/elGamalService";

export interface AuthorityOwnershipProof {
  issuedAt: number;
  publicKeyX: string;
  publicKeyY: string;
  signature: string;
}

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

export function deriveAuthorityPublicKey(privateKey: string): {
  x: string;
  y: string;
} {
  const scalar = BigInt(privateKey.trim());
  if (scalar <= 0n) {
    throw new Error("Authority private key must be a positive integer");
  }

  const point = EdwardsPoint.base().multiply(scalar);
  if (!point.isOnCurve()) {
    throw new Error("Derived authority public key is not on the BabyJubJub curve");
  }

  return {
    x: point.x.toString(),
    y: point.y.toString(),
  };
}

export function buildAuthorityLinkMessage(
  authUserId: string,
  publicKey: { x: string; y: string },
  authorityName: string,
  issuedAt: number
): string {
  return [
    "votex:authority-link:v1",
    authUserId,
    publicKey.x,
    publicKey.y,
    authorityName,
    issuedAt.toString(),
  ].join(":");
}

export async function createAuthorityOwnershipProof(
  authUserId: string,
  authorityName: string,
  privateKey: string
): Promise<AuthorityOwnershipProof> {
  const issuedAt = Date.now();
  const publicKey = deriveAuthorityPublicKey(privateKey);
  const sk = BigInt(privateKey.trim());
  const Ax = BigInt(publicKey.x);
  const Ay = BigInt(publicKey.y);

  const message = buildAuthorityLinkMessage(authUserId, publicKey, authorityName, issuedAt);
  const msgField = await hashMessageToField(message);

  // Deterministic nonce: r = Poseidon(sk, msgField)
  const r = poseidon2([sk, msgField]) % CURVE_ORDER;

  // R = r * Base8
  const R = EdwardsPoint.base().multiply(r);

  // Challenge: h = Poseidon(R.x, R.y, A.x, A.y, msgField)
  const h = poseidon5([R.x, R.y, Ax, Ay, msgField]) % CURVE_ORDER;

  // Response: S = (r + h * sk) mod subOrder
  const S = (r + ((h * sk) % CURVE_ORDER)) % CURVE_ORDER;

  return {
    issuedAt,
    publicKeyX: publicKey.x,
    publicKeyY: publicKey.y,
    signature: JSON.stringify({
      R8: { x: R.x.toString(), y: R.y.toString() },
      S: S.toString(),
      message,
    }),
  };
}
