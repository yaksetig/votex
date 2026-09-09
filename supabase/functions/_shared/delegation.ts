// Delegation authorisation messages, shared by delegation-write and its tests.
// Must match src/services/delegationService.ts.

import { verifyPoseidonSignature } from "./eddsa.ts";

export const DELEGATION_PROOF_MAX_AGE_MS = 5 * 60 * 1000;
export const DELEGATION_PROOF_MAX_FUTURE_SKEW_MS = 60 * 1000;

export interface DelegationCiphertext {
  c1: { x: string; y: string };
  c2: { x: string; y: string };
}

export function buildDelegationMessage(
  action: "create" | "revoke",
  electionId: string,
  issuedAt: number,
  ciphertext?: DelegationCiphertext
): string {
  const parts = ["votex:delegation:v1", action, electionId];
  if (action === "create") {
    if (!ciphertext) {
      throw new Error("create delegation message requires a ciphertext");
    }
    parts.push(ciphertext.c1.x, ciphertext.c1.y, ciphertext.c2.x, ciphertext.c2.y);
  }
  parts.push(issuedAt.toString());
  return parts.join(":");
}

export interface DelegationAuthorization {
  issuedAt: number;
  signature: string;
}

export type DelegationAuthorizationFailure =
  | "MALFORMED"
  | "FUTURE"
  | "EXPIRED"
  | "INVALID_SIGNATURE";

/**
 * Verify that the session holder's registered voting key signed this exact
 * delegation action recently. Returns null when valid.
 */
export async function verifyDelegationAuthorization(
  authorization: DelegationAuthorization | undefined,
  publicKey: { x: string; y: string },
  action: "create" | "revoke",
  electionId: string,
  ciphertext: DelegationCiphertext | undefined,
  now: number = Date.now()
): Promise<DelegationAuthorizationFailure | null> {
  if (
    !authorization ||
    !Number.isSafeInteger(authorization.issuedAt) ||
    typeof authorization.signature !== "string" ||
    authorization.signature.length === 0 ||
    authorization.signature.length > 2048
  ) {
    return "MALFORMED";
  }
  if (authorization.issuedAt > now + DELEGATION_PROOF_MAX_FUTURE_SKEW_MS) {
    return "FUTURE";
  }
  if (now - authorization.issuedAt > DELEGATION_PROOF_MAX_AGE_MS) {
    return "EXPIRED";
  }

  const expectedMessage = buildDelegationMessage(action, electionId, authorization.issuedAt, ciphertext);
  try {
    const valid = await verifyPoseidonSignature(authorization.signature, publicKey, expectedMessage);
    return valid ? null : "INVALID_SIGNATURE";
  } catch {
    return "INVALID_SIGNATURE";
  }
}
