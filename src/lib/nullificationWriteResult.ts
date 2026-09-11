/**
 * Result contract of the nullification write path, kept free of Supabase
 * imports so the mapping can be unit-tested and reused by the page's retry
 * loop.
 */

export type NullificationWriteCode =
  | "ACCUMULATOR_CONFLICT"
  | "RATE_LIMITED"
  | "ELECTION_CLOSED"
  | "NO_SESSION"
  | "UNKNOWN";

export interface NullificationWriteResult {
  ok: boolean;
  code?: NullificationWriteCode;
  message?: string;
}

/** Map a server error code onto the codes the nullification page branches on. */
export function normalizeWriteCode(code: unknown): NullificationWriteCode {
  switch (code) {
    case "ACCUMULATOR_CONFLICT":
    case "RATE_LIMITED":
    case "ELECTION_CLOSED":
      return code;
    default:
      return "UNKNOWN";
  }
}
