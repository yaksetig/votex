import { describe, expect, it } from "vitest";
import { applyTally, countBallots, describeOutcome } from "@/lib/electionResults";

const ballots = [
  { voterPseudonym: "a", choice: "Yes" },
  { voterPseudonym: "b", choice: "No" },
  { voterPseudonym: "c", choice: "Yes" },
  { voterPseudonym: "d", choice: "Maybe" },
];

describe("countBallots", () => {
  it("counts only the two options and ignores unknown choices", () => {
    expect(countBallots(ballots, "Yes", "No")).toEqual({ option1: 2, option2: 1, total: 3 });
  });
});

describe("applyTally", () => {
  it("drops nullified ballots and applies delegation weight", () => {
    const tally = [
      { userId: "a", voteNullified: true, voteWeight: 1 },
      { userId: "b", voteNullified: false, voteWeight: 3 },
      { userId: "c", voteNullified: false, voteWeight: 1 },
    ];
    expect(applyTally(ballots, tally, "Yes", "No")).toEqual({ option1: 1, option2: 3, total: 4 });
  });

  it("counts a ballot without a tally row once", () => {
    expect(applyTally(ballots, [], "Yes", "No")).toEqual({ option1: 2, option2: 1, total: 3 });
  });
});

describe("describeOutcome", () => {
  it("reports a leader, a tie, or nothing", () => {
    expect(describeOutcome("tallied", { option1: 3, option2: 1, total: 4 })).toMatchObject({ leader: 0, tie: false });
    expect(describeOutcome("tallied", { option1: 1, option2: 3, total: 4 })).toMatchObject({ leader: 1, tie: false });
    expect(describeOutcome("preliminary", { option1: 2, option2: 2, total: 4 })).toMatchObject({ leader: null, tie: true });
    expect(describeOutcome("running", { option1: 0, option2: 0, total: 0 })).toMatchObject({ leader: null, tie: false });
  });
});
