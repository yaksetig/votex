import { StoredKeypair } from "@/types/keypair";
import { logger } from "@/services/logger";
import {
  parseSignaturePayload,
  publicKeyFromStrings,
  signMessageWithStoredSeed,
  verifySignatureObject,
} from "@/services/eddsaService";

function buildVoteMessage(
  electionId: string,
  choice: string,
  timestamp: number
): string {
  return `${electionId}:${choice}:${timestamp}`;
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
  if (!keypair.seed) {
    throw new Error("Stored keypair is missing its EdDSA seed");
  }

  const timestamp = Date.now();
  const message = buildVoteMessage(electionId, choice, timestamp);
  const signatureObject = await signMessageWithStoredSeed(keypair.seed, message);

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
    return verifySignatureObject(
      parseSignaturePayload(signature),
      publicKeyFromStrings(publicKey)
    );
  } catch (error) {
    logger.error("EdDSA signature verification failed:", error);
    return false;
  }
}
