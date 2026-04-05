import { CURVE_ORDER } from "@/services/crypto/constants";
import { EdwardsPoint } from "@/services/elGamalService";
import { hashToScalarBE, stringToBytes, toBytesBE } from "@/services/crypto/utils";

export interface AuthorityOwnershipProof {
  issuedAt: number;
  publicKeyX: string;
  publicKeyY: string;
  signature: string;
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
  const scalar = BigInt(privateKey.trim());
  const message = buildAuthorityLinkMessage(authUserId, publicKey, authorityName, issuedAt);
  const messageBytes = stringToBytes(message);

  const r = await hashToScalarBE(CURVE_ORDER, toBytesBE(scalar), messageBytes);
  const rPoint = EdwardsPoint.base().multiply(r);
  const rx = rPoint.x;
  const ry = rPoint.y;

  const challenge = await hashToScalarBE(
    CURVE_ORDER,
    toBytesBE(rx),
    toBytesBE(BigInt(publicKey.x)),
    messageBytes
  );

  const s = (r + scalar * challenge) % CURVE_ORDER;

  return {
    issuedAt,
    publicKeyX: publicKey.x,
    publicKeyY: publicKey.y,
    signature: JSON.stringify({
      R: { x: rx.toString(), y: ry.toString() },
      message,
      s: s.toString(),
    }),
  };
}
