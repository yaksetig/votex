import { describe, expect, it, vi } from "vitest";
import {
  MAX_NULLIFICATION_ATTEMPTS,
  NullificationFlowError,
  submitNullificationWithRetry,
} from "../services/nullificationFlow";

const batch = (slotCount = 6) => ({ slotCount, items: [] });

describe("submitNullificationWithRetry", () => {
  it("submits once when the server accepts the batch", async () => {
    const generate = vi.fn().mockResolvedValue(batch());
    const submit = vi.fn().mockResolvedValue({ ok: true });
    await expect(submitNullificationWithRetry({ generate, submit })).resolves.toEqual({ slotCount: 6, attempts: 1 });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("regenerates against fresh state on an accumulator conflict and reports progress", async () => {
    const generate = vi.fn().mockResolvedValueOnce(batch(6)).mockResolvedValueOnce(batch(5));
    const submit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "ACCUMULATOR_CONFLICT" })
      .mockResolvedValueOnce({ ok: true });
    const onProgress = vi.fn();
    await expect(submitNullificationWithRetry({ generate, submit, onProgress })).resolves.toEqual({ slotCount: 5, attempts: 2 });
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ step: "preparing", message: expect.stringMatching(/regenerating/) }));
  });

  it("gives up after the last attempt and surfaces the conflict", async () => {
    const generate = vi.fn().mockResolvedValue(batch());
    const submit = vi.fn().mockResolvedValue({ ok: false, code: "ACCUMULATOR_CONFLICT" });
    const failure = await submitNullificationWithRetry({ generate, submit }).catch((e) => e);
    expect(failure).toBeInstanceOf(NullificationFlowError);
    expect(failure.code).toBe("ACCUMULATOR_CONFLICT");
    expect(submit).toHaveBeenCalledTimes(MAX_NULLIFICATION_ATTEMPTS);
  });

  it("does not retry hard failures and maps them to user-facing reasons", async () => {
    for (const [code, pattern] of [
      ["RATE_LIMITED", /one nullification batch per minute/],
      ["ELECTION_CLOSED", /no longer being accepted/],
      ["NO_SESSION", /session has expired/],
      ["UNKNOWN", /Failed to store nullifications/],
    ] as const) {
      const submit = vi.fn().mockResolvedValue({ ok: false, code });
      const failure = await submitNullificationWithRetry({ generate: vi.fn().mockResolvedValue(batch()), submit }).catch((e) => e);
      expect(failure.code).toBe(code);
      expect(failure.message).toMatch(pattern);
      expect(submit).toHaveBeenCalledTimes(1);
    }
  });

  it("prefers the server's message for unknown failures", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, code: "UNKNOWN", message: "disk full" });
    const failure = await submitNullificationWithRetry({ generate: vi.fn().mockResolvedValue(batch()), submit }).catch((e) => e);
    expect(failure.message).toBe("disk full");
  });
});
