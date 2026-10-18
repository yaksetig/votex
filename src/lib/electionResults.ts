/**
 * Pure result arithmetic for an election page.
 *
 * Two kinds of numbers exist and must never be confused on screen:
 * - the running count: ballots as cast, nothing resolved;
 * - the tallied result: ballots after the Election Authority resolved
 *   nullifications and delegation weights (rows in public_tallies).
 */

export interface PublicBallot {
  voterPseudonym: string;
  choice: string;
}

export interface TallyRow {
  userId: string;
  voteNullified: boolean;
  voteWeight: number;
}

export interface OptionCounts {
  option1: number;
  option2: number;
  total: number;
}

export type ResultsKind = "running" | "preliminary" | "tallied";

export interface ElectionOutcome {
  kind: ResultsKind;
  counts: OptionCounts;
  /** 0 = option1 leads, 1 = option2 leads, null = tie or no ballots. */
  leader: 0 | 1 | null;
  tie: boolean;
}

export function countBallots(ballots: PublicBallot[], option1: string, option2: string): OptionCounts {
  let a = 0;
  let b = 0;
  for (const ballot of ballots) {
    if (ballot.choice === option1) a += 1;
    else if (ballot.choice === option2) b += 1;
  }
  return { option1: a, option2: b, total: a + b };
}

/**
 * Applies the tally to the public ballots: nullified ballots drop out and
 * each remaining ballot counts with its delegated weight. Ballots without a
 * tally row (should not happen after a complete tally) count once.
 */
export function applyTally(ballots: PublicBallot[], tally: TallyRow[], option1: string, option2: string): OptionCounts {
  const byVoter = new Map(tally.map((row) => [row.userId, row]));
  let a = 0;
  let b = 0;
  for (const ballot of ballots) {
    const row = byVoter.get(ballot.voterPseudonym);
    if (row?.voteNullified) continue;
    const weight = row ? Math.max(0, row.voteWeight) : 1;
    if (ballot.choice === option1) a += weight;
    else if (ballot.choice === option2) b += weight;
  }
  return { option1: a, option2: b, total: a + b };
}

export function describeOutcome(kind: ResultsKind, counts: OptionCounts): ElectionOutcome {
  const tie = counts.total > 0 && counts.option1 === counts.option2;
  const leader: ElectionOutcome["leader"] =
    counts.total === 0 || tie ? null : counts.option1 > counts.option2 ? 0 : 1;
  return { kind, counts, leader, tie };
}
