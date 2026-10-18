import { describe, expect, it } from "vitest";
import { resolveDelegateIndex, sortParticipantsForDelegation } from "@/lib/delegationTargets";

const participants = [
  { id: "p3", election_id: "e", participant_id: "0xcc", public_key_x: "30", public_key_y: "31", joined_at: "2026-01-03T00:00:00Z" },
  { id: "p1", election_id: "e", participant_id: "0xaa", public_key_x: "10", public_key_y: "11", joined_at: "2026-01-01T00:00:00Z" },
  { id: "p2", election_id: "e", participant_id: "0xbb", public_key_x: "20", public_key_y: "21", joined_at: "2026-01-02T00:00:00Z" },
];

describe("delegation targets", () => {
  it("sorts by joined_at ascending, matching the tally's index order", () => {
    expect(sortParticipantsForDelegation(participants).map((p) => p.participant_id)).toEqual(["0xaa", "0xbb", "0xcc"]);
  });

  it("resolves a pasted pseudonym or key to the sorted index", () => {
    const sorted = sortParticipantsForDelegation(participants);
    expect(resolveDelegateIndex(sorted, "0xbb", "0xaa")).toBe(1);
    expect(resolveDelegateIndex(sorted, " 0XCC ", "0xaa")).toBe(2);
    expect(resolveDelegateIndex(sorted, "20", "0xaa")).toBe(1);
    expect(resolveDelegateIndex(sorted, "30,31", "0xaa")).toBe(2);
  });

  it("never resolves to the voter themself or to an unknown value", () => {
    const sorted = sortParticipantsForDelegation(participants);
    expect(resolveDelegateIndex(sorted, "0xaa", "0xaa")).toBeNull();
    expect(resolveDelegateIndex(sorted, "0xzz", "0xaa")).toBeNull();
    expect(resolveDelegateIndex(sorted, "", "0xaa")).toBeNull();
  });
});
