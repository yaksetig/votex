/**
 * Orchestration of one nullification request from the voter's point of view:
 * generate a k-anonymity batch, submit it, and regenerate on an accumulator
 * conflict. Kept free of React and Supabase so the retry policy is unit-
 * testable; the page supplies the generator and writer.
 *
 * Why retry at all: proof generation takes seconds, and any participant may
 * touch any slot in the meantime (a decoy needs no secret). A stale batch is
 * rejected with ACCUMULATOR_CONFLICT, so the client regenerates against the
 * fresh state instead of surfacing a spurious failure.
 *
 * Cancellation: the voter may abort while proofs are being generated. Once
 * `submit` has started the request is on its way, so the flow never aborts
 * after the "submitting" step and a late abort is ignored.
 */

import type { KAnonymityProgress } from "@/services/kAnonymityNullificationService";
import type { NullificationWriteResult } from "@/lib/nullificationWriteResult";

export const MAX_NULLIFICATION_ATTEMPTS = 3;

export type NullificationFlowCode = NonNullable<NullificationWriteResult["code"]> | "CANCELLED";

export interface GeneratedNullificationBatch {
  slotCount: number;
  /** Opaque to the flow; passed straight to `submit`. */
  items: unknown;
}

export interface NullificationFlowDeps<Batch extends GeneratedNullificationBatch> {
  generate: (onProgress: (progress: KAnonymityProgress) => void, signal?: AbortSignal) => Promise<Batch>;
  submit: (batch: Batch) => Promise<NullificationWriteResult>;
  onProgress?: (progress: KAnonymityProgress) => void;
  maxAttempts?: number;
  /** Aborting cancels generation; it has no effect once submission has begun. */
  signal?: AbortSignal;
}

export class NullificationFlowError extends Error {
  constructor(
    readonly code: NullificationFlowCode,
    message: string
  ) {
    super(message);
    this.name = "NullificationFlowError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/** Human-readable reasons for the codes the page cannot recover from. */
export function describeNullificationFailure(result: NullificationWriteResult): string {
  switch (result.code) {
    case "RATE_LIMITED":
      return "You submitted a request less than a minute ago. Wait a moment and try again.";
    case "ELECTION_CLOSED":
      return "This election is closed, so nullification requests are no longer accepted.";
    case "NO_SESSION":
      return "Your session expired. Sign in again to continue.";
    default:
      return result.message || "Failed to store nullifications";
  }
}

/**
 * Run the generate/submit loop. Resolves with the number of slots in the
 * accepted batch; rejects with NullificationFlowError carrying the server
 * code, or CANCELLED when the voter aborted before submission.
 */
export async function submitNullificationWithRetry<Batch extends GeneratedNullificationBatch>(
  deps: NullificationFlowDeps<Batch>
): Promise<{ slotCount: number; attempts: number }> {
  const maxAttempts = deps.maxAttempts ?? MAX_NULLIFICATION_ATTEMPTS;
  const onProgress = deps.onProgress ?? (() => undefined);
  const signal = deps.signal;

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new NullificationFlowError("CANCELLED", "The request was cancelled before anything was sent.");
    }
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfAborted();
    let batch: Batch;
    try {
      batch = await deps.generate(onProgress, signal);
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw new NullificationFlowError("CANCELLED", "The request was cancelled before anything was sent.");
      }
      throw error;
    }
    // Last chance to stop: after this point the batch is on its way.
    throwIfAborted();
    onProgress({
      step: "submitting",
      completed: batch.slotCount,
      total: batch.slotCount,
      message: "Sending your request",
    });

    const result = await deps.submit(batch);
    if (result.ok) {
      return { slotCount: batch.slotCount, attempts: attempt };
    }

    if (result.code === "ACCUMULATOR_CONFLICT" && attempt < maxAttempts) {
      onProgress({
        step: "preparing",
        completed: 0,
        total: 0,
        message: "Another voter submitted at the same time. Preparing your request again.",
      });
      continue;
    }

    throw new NullificationFlowError(result.code ?? "UNKNOWN", describeNullificationFailure(result));
  }

  // Unreachable: the loop either returns or throws on its final attempt.
  throw new NullificationFlowError("UNKNOWN", "Failed to store nullifications");
}
