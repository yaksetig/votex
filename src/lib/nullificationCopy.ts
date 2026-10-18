import type { KAnonymityProgress } from "@/services/kAnonymityNullificationService";
import { pluralize } from "@/lib/format";

/** Service steps in the voter's words. Service `message` strings never reach the screen. */
export function describeProgress(progress: KAnonymityProgress | null): string {
  if (!progress) return "Preparing your request";
  switch (progress.step) {
    case "preparing":
      return progress.message.startsWith("Another voter")
        ? "Another voter submitted at the same time. Preparing your request again"
        : "Preparing your request";
    case "encrypting":
      return progress.total > 1
        ? `Hiding your request among ${pluralize(progress.total, "participant")}`
        : "Preparing your request";
    case "proving":
      return progress.total > 0
        ? `Building proof ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}`
        : "Building proofs";
    case "submitting":
      return "Sending your request";
    case "complete":
      return "Proofs ready";
    default:
      return "Working";
  }
}

