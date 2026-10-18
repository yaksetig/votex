import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES, describeError, describeWorldIdError } from "@/lib/errorMessages";
import { VotexApiError, type ApiErrorCode } from "@/types/api";

const ALL_CODES: ApiErrorCode[] = [
  "VALIDATION_ERROR",
  "PAYLOAD_TOO_LARGE",
  "METHOD_NOT_ALLOWED",
  "SESSION_REQUIRED",
  "SESSION_EXPIRED",
  "VERIFIER_MISSING",
  "AUTHORITY_REQUIRED",
  "FIXED_AUTHORITY_UNAVAILABLE",
  "NOT_FOUND",
  "ELECTION_CLOSED",
  "ELECTION_STILL_ACTIVE",
  "ELECTION_ALREADY_STARTED",
  "PARTICIPANT_REQUIRED",
  "INVALID_CHOICE",
  "INVALID_SIGNATURE",
  "INVALID_PROOF",
  "KEYPAIR_ALREADY_BOUND",
  "PUBLIC_KEY_ALREADY_BOUND",
  "ACCUMULATOR_CONFLICT",
  "RATE_LIMITED",
  "CONFLICT",
  "INTERNAL_ERROR",
  "UNKNOWN",
];

describe("describeError", () => {
  it("has a sentence for every API error code", () => {
    for (const code of ALL_CODES) {
      const message = API_ERROR_MESSAGES[code];
      expect(message, code).toBeTruthy();
      expect(message, code).toMatch(/[.!]$/);
      expect(describeError(new VotexApiError(code, "raw server text"), "fallback")).toBe(message);
    }
  });

  it("never shows a raw Error.message", () => {
    expect(describeError(new Error("ECONNRESET at socket.js:12"), "Your ballot could not be recorded.")).toBe(
      "Your ballot could not be recorded."
    );
  });

  it("maps WebAuthn exceptions by name", () => {
    const cancelled = new DOMException("User cancelled", "NotAllowedError");
    expect(describeError(cancelled, "fallback")).toMatch(/cancelled or timed out/);
  });

  it("maps PRF-unsupported errors to the passkey-type explanation", () => {
    expect(describeError(new Error("Authenticator did not return the PRF extension"), "fallback")).toMatch(
      /hmac-secret/
    );
  });

  it("maps World ID codes", () => {
    expect(describeWorldIdError("verification_rejected")).toMatch(/declined/);
    expect(describeWorldIdError("something_new")).toMatch(/did not complete/);
    expect(describeError({ code: "max_verifications_reached" }, "fallback")).toMatch(/already been used/);
  });

  it("treats flow-level codes consistently", () => {
    expect(describeError({ code: "NO_SESSION" }, "fallback")).toBe(API_ERROR_MESSAGES.SESSION_REQUIRED);
    expect(describeError({ code: "CANCELLED" }, "fallback")).toBe("Cancelled.");
  });
});
