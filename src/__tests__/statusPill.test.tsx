/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "@/components/StatusPill";
import { getElectionLifecycle } from "@/lib/electionLifecycle";

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe("getElectionLifecycle", () => {
  it("is open while the end date is ahead and nothing closed it", () => {
    expect(getElectionLifecycle({ end_date: future })).toBe("open");
  });

  it("distinguishes early closure from expiry when the tally state is unknown", () => {
    expect(getElectionLifecycle({ end_date: past })).toBe("closed");
    expect(getElectionLifecycle({ end_date: future, closed_manually_at: past })).toBe("closed_early");
  });

  it("reports the tally state when the caller knows it", () => {
    expect(getElectionLifecycle({ end_date: past }, { tallied: false })).toBe("tally_pending");
    expect(getElectionLifecycle({ end_date: past }, { tallied: true })).toBe("tallied");
    // An open election is never "tallied", whatever the caller passes.
    expect(getElectionLifecycle({ end_date: future }, { tallied: true })).toBe("open");
  });
});

describe("StatusPill", () => {
  it("renders the shared label for each lifecycle", () => {
    render(
      <>
        <StatusPill lifecycle="open" />
        <StatusPill lifecycle="closed_early" />
        <StatusPill lifecycle="tally_pending" />
        <StatusPill lifecycle="tallied" />
      </>
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Closed early")).toBeInTheDocument();
    expect(screen.getByText("Tally pending")).toBeInTheDocument();
    expect(screen.getByText("Tallied")).toBeInTheDocument();
  });
});
