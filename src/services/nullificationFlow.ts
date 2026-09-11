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
 */

import type { KAnonymityProgress } from "@/services/kAnonymityNullificationService";
import type { NullificationWriteResult } from "@/lib/nullificationWriteResult";

export const MAX_NULLIFICATION_ATTEMPTS = 3;

export interface GeneratedNullificationBatch {
  slotCount: number;
  /** Opaque to the flow; passed straight to `submit`. */
  items: unknown;
}

export interface NullificationFlowDeps<Batch extends GeneratedNullificationBatch> {
  generate: (onProgress: (progress: KAnonymityProgress) => void) => Promise<Batch>;
  submit: (batch: Batch) => Promise<NullificationWriteResult>;
  onProgress?: (progress: KAnonymityProgress) => void;
  maxAttempts?: number;
}

export class NullificationFlowError extends Error {
  constructor(
    readonly code: NullificationWriteResult["code"],
    message: string
  ) {
    super(message);
    this.name = "NullificationFlowError";
  }
}

/** Human-readable reasons for the codes the page cannot recover from. */
export function describeNullificationFailure(result: NullificationWriteResult): string {
  switch (result.code) {
    case "RATE_LIMITED":
      return "Only one nullification batch per minute is accepted. Please wait and try again.";
    case "ELECTION_CLOSED":
      return "Nullifications are no longer being accepted for this election.";
    case "NO_SESSION":
      return "Your voter session has expired. Sign in again to continue.";
    default:
      return result.message || "Failed to store nullifications";
  }
}

/**
 * Run the generate/submit loop. Resolves with the number of slots in the
 * accepted batch; rejects with NullificationFlowError carrying the server code.
 */
export async function submitNullificationWithRetry<Batch extends GeneratedNullificationBatch>(
  deps: NullificationFlowDeps<Batch>
): Promise<{ slotCount: number; attempts: number }> {
  const maxAttempts = deps.maxAttempts ?? MAX_NULLIFICATION_ATTEMPTS;
  const onProgress = deps.onProgress ?? (() => undefined);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const batch = await deps.generate(onProgress);
    const result = await deps.submit(batch);
    if (result.ok) {
      return { slotCount: batch.slotCount, attempts: attempt };
    }

    if (result.code === "ACCUMULATOR_CONFLICT" && attempt < maxAttempts) {
      onProgress({
        step: "preparing",
        completed: 0,
        total: 0,
        message: "Another participant updated a slot; regenerating proofs...",
      });
      continue;
    }

    throw new NullificationFlowError(result.code, describeNullificationFailure(result));
  }

  // Unreachable: the loop either returns or throws on its final attempt.
  throw new NullificationFlowError("UNKNOWN", "Failed to store nullifications");
}
