import { corsHeaders } from "./cors.ts";

/**
 * Machine-readable error codes returned by every edge function. The browser
 * branches on these (src/types/api.ts); the message is for humans only.
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "METHOD_NOT_ALLOWED"
  | "SESSION_REQUIRED"
  | "SESSION_EXPIRED"
  | "VERIFIER_MISSING"
  | "AUTHORITY_REQUIRED"
  | "FIXED_AUTHORITY_UNAVAILABLE"
  | "NOT_FOUND"
  | "ELECTION_CLOSED"
  | "ELECTION_STILL_ACTIVE"
  | "ELECTION_ALREADY_STARTED"
  | "PARTICIPANT_REQUIRED"
  | "INVALID_CHOICE"
  | "INVALID_SIGNATURE"
  | "INVALID_PROOF"
  | "KEYPAIR_ALREADY_BOUND"
  | "PUBLIC_KEY_ALREADY_BOUND"
  | "ACCUMULATOR_CONFLICT"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

/** Every error leaves through here so the {code, error} shape is uniform. */
export function errorResponse(status: number, code: ApiErrorCode, message: string): Response {
  return jsonResponse(status, { code, error: message });
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export { sha256Hex } from "./protocol.ts";
