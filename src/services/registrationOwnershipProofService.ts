/**
 * Registration Ownership Proof Service
 *
 * register-keypair requires proof that the caller controls the private
 * scalar behind the public key being bound to a World ID nullifier. Without
 * it, anyone with a World ID proof could register (and later lock out)
 * another voter's public key. The message is domain-separated and names the
 * nullifier, the key, and a timestamp the server checks for freshness.
 */

import { buildRegistrationOwnershipMessage } from "@protocol";
import { deriveKeypairFromSecret } from "@/services/deterministicKeyService";
import { signMessageWithSeed } from "@/services/eddsaService";

export interface RegistrationOwnershipProof {
  issuedAt: number;
  signature: string;
}

export { buildRegistrationOwnershipMessage };

export async function createRegistrationOwnershipProof(
  prfSecret: ArrayBuffer,
  nullifier: string,
  publicKey: { x: string; y: string }
): Promise<RegistrationOwnershipProof> {
  const issuedAt = Date.now();
  const keypair = await deriveKeypairFromSecret(prfSecret);
  const message = buildRegistrationOwnershipMessage(nullifier, publicKey, issuedAt);
  const signature = await signMessageWithSeed(keypair.seed, message);

  return { issuedAt, signature: JSON.stringify(signature) };
}
