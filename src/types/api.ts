import type { Election } from "@/types/election";

/** Mirrors ApiErrorCode in supabase/functions/_shared/http.ts. */
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
  | "INTERNAL_ERROR"
  | "UNKNOWN";

export interface ApiErrorBody {
  code?: ApiErrorCode;
  error?: string;
}

export interface CreateElectionRequest {
  sessionToken: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  endDate: string;
  idempotencyKey: string;
}

export interface CreateElectionResponse {
  election: Election;
  authorityId: string;
}

export interface VoteReceipt {
  receiptId: string;
  electionId: string;
  electionTitle: string;
  voterPseudonym: string;
  choice: string;
  signature: string;
  signedAt: number;
  acceptedAt: string;
  signatureVerified: boolean;
}

export class VotexApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "VotexApiError";
    this.code = code;
  }
}

export async function readFunctionError(
  error: { message?: string; context?: Response } | null,
  fallbackCode: ApiErrorCode,
  fallbackMessage: string
): Promise<VotexApiError> {
  const response = error?.context;
  const body = response
    ? await response.json().catch(() => null) as ApiErrorBody | null
    : null;

  return new VotexApiError(
    body?.code ?? fallbackCode,
    body?.error ?? error?.message ?? fallbackMessage
  );
}
