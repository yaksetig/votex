// Single source of truth for deriving an election's lifecycle status.
// Previously re-implemented inline in electionDataService, Elections,
// and ElectionAuthorityDashboard.

export type ElectionStatus = "active" | "closed_manually" | "expired";

export interface ElectionStatusInput {
  end_date: string;
  closed_manually_at?: string | null;
  status?: string | null;
}

export function getElectionStatus(election: ElectionStatusInput): ElectionStatus {
  if (election.closed_manually_at || election.status === "closed_manually") {
    return "closed_manually";
  }
  if (new Date(election.end_date).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

export function isElectionClosed(election: ElectionStatusInput): boolean {
  return getElectionStatus(election) !== "active";
}
