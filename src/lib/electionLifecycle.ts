import { getElectionStatus, type ElectionStatusInput } from "@/lib/electionStatus";

/**
 * The user-facing lifecycle of an election: what `getElectionStatus` knows
 * plus whether the Election Authority has run the tally. Every surface that
 * names an election's state renders this through StatusPill, so "Open",
 * "Closed", "Closed early", "Tally pending" and "Tallied" mean the same
 * thing on the list, the detail page and the authority console.
 */
export type ElectionLifecycle = "open" | "closed" | "closed_early" | "tally_pending" | "tallied";

export const LIFECYCLE_LABELS: Record<ElectionLifecycle, string> = {
  open: "Open",
  closed: "Closed",
  closed_early: "Closed early",
  tally_pending: "Tally pending",
  tallied: "Tallied",
};

/**
 * `tallied` is optional: pass it when the caller knows whether a tally ran
 * (authority console, closed election page); omit it where that is unknown
 * (the elections list), and the pill falls back to Closed / Closed early.
 */
export function getElectionLifecycle(
  election: ElectionStatusInput,
  options: { tallied?: boolean } = {}
): ElectionLifecycle {
  const status = getElectionStatus(election);
  if (status === "active") {
    return "open";
  }
  if (options.tallied === true) {
    return "tallied";
  }
  if (options.tallied === false) {
    return "tally_pending";
  }
  return status === "closed_manually" ? "closed_early" : "closed";
}

export function describeLifecycle(lifecycle: ElectionLifecycle): string {
  return LIFECYCLE_LABELS[lifecycle];
}
