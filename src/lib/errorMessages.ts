/**
 * Turns anything thrown by a service into one sentence a voter or operator
 * can act on. Raw `Error.message` strings never reach the screen: they are
 * written by libraries and edge functions for developers, so `describeError`
 * maps known codes to copy and falls back to the caller's sentence.
 */

import type { ApiErrorCode } from "@/types/api";
import { logger } from "@/services/logger";

export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: "Some of the information sent was not valid. Check the form and try again.",
  PAYLOAD_TOO_LARGE: "The request was too large to process.",
  METHOD_NOT_ALLOWED: "That action is not available here.",
  SESSION_REQUIRED: "Sign in to continue.",
  SESSION_EXPIRED: "Your session expired. Sign in again to continue.",
  VERIFIER_MISSING: "Your voting key is not set up on this device yet. Unlock your passkey first.",
  AUTHORITY_REQUIRED: "Only the Election Authority can do this.",
  FIXED_AUTHORITY_UNAVAILABLE: "The Election Authority is not configured yet, so elections cannot be created right now.",
  NOT_FOUND: "We could not find that record.",
  ELECTION_CLOSED: "This election is closed, so no more changes can be made.",
  ELECTION_STILL_ACTIVE: "This election is still open. Close it before running the tally.",
  ELECTION_ALREADY_STARTED: "Ballots have already been cast, so the election details can no longer be edited.",
  PARTICIPANT_REQUIRED: "Your voting key is not registered for this election yet. Unlock your passkey and try again.",
  INVALID_CHOICE: "That option does not belong to this election.",
  INVALID_SIGNATURE: "Your voting key could not sign this request. Unlock your passkey and try again.",
  INVALID_PROOF: "The request could not be verified. Try again.",
  KEYPAIR_ALREADY_BOUND: "This World ID is already linked to a different passkey. Use that passkey to sign in.",
  PUBLIC_KEY_ALREADY_BOUND: "This passkey is already linked to a different World ID.",
  ACCUMULATOR_CONFLICT: "Another voter submitted at the same time. Try again.",
  RATE_LIMITED: "You submitted a request less than a minute ago. Wait a moment and try again.",
  CONFLICT: "The request could not be completed because the record changed. Refresh and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Try again in a moment.",
  UNKNOWN: "Something went wrong. Try again.",
};

/** WebAuthn `DOMException` names and what they mean for a Votex passkey. */
const WEBAUTHN_MESSAGES: Record<string, string> = {
  NotAllowedError: "The passkey prompt was cancelled or timed out. Try again when you are ready.",
  InvalidStateError: "This passkey is already registered on this device. Choose \"Continue with passkey\" instead.",
  NotSupportedError: "This device or browser cannot create a Votex passkey. Try a browser with passkey support.",
  SecurityError: "Passkeys only work on the real Votex address over HTTPS. Open the site from its normal URL.",
  AbortError: "The passkey request was interrupted. Try again.",
  ConstraintError: "This passkey type cannot be used for Votex. Try one stored in iCloud Keychain, Google Password Manager, or a security key that supports hmac-secret.",
};

/** IDKit error codes (World ID) in plain language. */
const WORLD_ID_MESSAGES: Record<string, string> = {
  verification_rejected: "World ID verification was declined in the World App. Try again when you are ready.",
  max_verifications_reached: "This World ID has already been used to create a Votex identity.",
  credential_unavailable: "Your World ID does not have the credential Votex needs yet. Complete verification in the World App first.",
  malformed_request: "The verification request was not accepted. Reload the page and try again.",
  invalid_network: "World ID is running on a different network than this site expects.",
  inclusion_proof_failed: "World ID could not confirm your identity right now. Try again in a few minutes.",
  inclusion_proof_pending: "Your World ID is still being registered. Try again in a few minutes.",
  unexpected_response: "World ID returned an unexpected response. Try again.",
  failed_by_host_app: "Verification was stopped before it finished. Try again.",
  generic_error: "World ID verification did not complete. Try again.",
  connection_failed: "Could not reach World ID. Check your connection and try again.",
};

function hasCode(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string";
}

function hasName(error: unknown): error is { name: string } {
  return typeof error === "object" && error !== null && typeof (error as { name?: unknown }).name === "string";
}

/**
 * The sentence to show for `error`. `fallback` is the caller's own plain
 * sentence for the action that failed ("Your ballot could not be recorded").
 */
export function describeError(error: unknown, fallback: string): string {
  if (hasCode(error)) {
    const code = error.code;
    if (code in API_ERROR_MESSAGES) {
      return API_ERROR_MESSAGES[code as ApiErrorCode];
    }
    if (code === "NO_SESSION") {
      return API_ERROR_MESSAGES.SESSION_REQUIRED;
    }
    if (code === "CANCELLED") {
      return "Cancelled.";
    }
    if (code in WORLD_ID_MESSAGES) {
      return WORLD_ID_MESSAGES[code];
    }
  }
  if (hasName(error) && error.name in WEBAUTHN_MESSAGES) {
    return WEBAUTHN_MESSAGES[error.name];
  }
  if (error instanceof Error && /prf|hmac-secret/i.test(error.message)) {
    return WEBAUTHN_MESSAGES.ConstraintError;
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "Could not reach Votex. Check your connection and try again.";
  }
  if (error !== undefined) {
    logger.debug("Unmapped error shown with fallback copy", error);
  }
  return fallback;
}

/** Message for a World ID (IDKit) error code string. */
export function describeWorldIdError(code: string | undefined): string {
  return (code && WORLD_ID_MESSAGES[code]) || WORLD_ID_MESSAGES.generic_error;
}
