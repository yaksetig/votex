// Election lifecycle predicate shared by every write path. Mirrors
// src/lib/electionStatus.ts on the browser side.

export interface ElectionLifecycleRow {
  end_date: string;
  closed_manually_at: string | null;
}

/** An election accepts writes until it is closed manually or its end date passes. */
export function isElectionOpen(election: ElectionLifecycleRow, now: number = Date.now()): boolean {
  return !election.closed_manually_at && new Date(election.end_date).getTime() > now;
}
