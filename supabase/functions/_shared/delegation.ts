// Delegation authorisation checks shared by delegation-write and its tests.
// The message format itself lives in ./protocol.ts (shared with the browser).

import { verifyPoseidonSignature } from "./eddsa.ts";
import {
  buildDelegationMessage,
  checkProofFreshness,
  type CiphertextStrings,
  type DelegationAction,
  type FreshnessFailure,
} from "./protocol.ts";

export type DelegationCiphertext = CiphertextStrings;

export interface DelegationAuthorization {
  issuedAt: number;
  signature: string;
}

export type DelegationAuthorizationFailure = FreshnessFailure | "INVALID_SIGNATURE";

const MAX_SIGNATURE_LENGTH = 2048;

/**
 * Verify that the session holder's registered voting key signed this exact
 * delegation action recently. Returns null when valid.
 */
export async function verifyDelegationAuthorization(
  authorization: DelegationAuthorization | undefined,
  publicKey: { x: string; y: string },
  action: DelegationAction,
  electionId: string,
  ciphertext: DelegationCiphertext | undefined,
  now: number = Date.now()
): Promise<DelegationAuthorizationFailure | null> {
  if (
    !authorization ||
    typeof authorization.signature !== "string" ||
    authorization.signature.length === 0 ||
    authorization.signature.length > MAX_SIGNATURE_LENGTH
  ) {
    return "MALFORMED";
  }
  const freshness = checkProofFreshness(authorization.issuedAt, now);
  if (freshness) {
    return freshness;
  }

  const expectedMessage = buildDelegationMessage(action, electionId, authorization.issuedAt, ciphertext);
  try {
    const valid = await verifyPoseidonSignature(authorization.signature, publicKey, expectedMessage);
    return valid ? null : "INVALID_SIGNATURE";
  } catch {
    return "INVALID_SIGNATURE";
  }
}
