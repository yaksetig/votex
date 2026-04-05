/**
 * Authority Ownership Proof Service
 *
 * Generates an EdDSA-Poseidon signature proving ownership of a
 * BabyJubJub authority secret for authority linking.
 */

import {
  deriveAuthorityKeyMaterial,
  signMessageWithSeed,
} from "@/services/eddsaService";

export interface AuthorityOwnershipProof {
  issuedAt: number;
  publicKeyX: string;
  publicKeyY: string;
  signature: string;
}

export async function deriveAuthorityPublicKey(authoritySecret: string): Promise<{
  x: string;
  y: string;
}> {
  const keyMaterial = await deriveAuthorityKeyMaterial(authoritySecret);

  return {
    x: keyMaterial.publicKey.x.toString(),
    y: keyMaterial.publicKey.y.toString(),
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
  authoritySecret: string
): Promise<AuthorityOwnershipProof> {
  const issuedAt = Date.now();
  const keyMaterial = await deriveAuthorityKeyMaterial(authoritySecret);
  const publicKey = {
    x: keyMaterial.publicKey.x.toString(),
    y: keyMaterial.publicKey.y.toString(),
  };
  const message = buildAuthorityLinkMessage(authUserId, publicKey, authorityName, issuedAt);
  const signature = await signMessageWithSeed(keyMaterial.seed, message);

  return {
    issuedAt,
    publicKeyX: publicKey.x,
    publicKeyY: publicKey.y,
    signature: JSON.stringify(signature),
  };
}
