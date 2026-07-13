import type { Election } from "@/types/election";

export type ApiErrorCode =
  | "SESSION_REQUIRED"
  | "SESSION_EXPIRED"
  | "FIXED_AUTHORITY_UNAVAILABLE"
  | "ELECTION_CLOSED"
  | "ELECTION_ALREADY_STARTED"
  | "INVALID_CHOICE"
  | "INVALID_SIGNATURE"
  | "ALREADY_VOTED"
  | "PARTICIPANT_REQUIRED"
  | "STALE_ACCUMULATOR"
  | "AUTHORITY_REQUIRED"
  | "KEYPAIR_ALREADY_BOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR";

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
