/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import NullificationDialog from "@/components/NullificationDialog";
import KAnonymityProgressDialog from "@/components/KAnonymityProgressDialog";
import { describeProgress } from "@/lib/nullificationCopy";

describe("NullificationDialog", () => {
  it("renders two visually identical choices and never says actual or dummy", async () => {
    const onReal = vi.fn();
    const onDecoy = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NullificationDialog
          open
          onOpenChange={() => {}}
          onActualNullification={onReal}
          onDummyNullification={onDecoy}
          isProcessing={false}
        />
      </MemoryRouter>
    );
    const group = screen.getByRole("group", { name: "Request type" });
    const buttons = group.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].className).toBe(buttons[1].className);
    expect(buttons[0].querySelector("svg")?.outerHTML).toBe(buttons[1].querySelector("svg")?.outerHTML);
    expect(screen.queryByText(/actual|dummy|type-0/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Send a decoy/ }));
    expect(onDecoy).toHaveBeenCalledTimes(1);
    expect(onReal).not.toHaveBeenCalled();
  });
});

describe("KAnonymityProgressDialog", () => {
  it("never shows NaN and exposes a progressbar", () => {
    render(<KAnonymityProgressDialog open progress={{ step: "preparing", completed: 0, total: 0, message: "x" }} />);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Nullification request progress" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  it("offers Cancel until the request is being sent", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <KAnonymityProgressDialog open progress={{ step: "proving", completed: 2, total: 6, message: "x" }} onCancel={onCancel} />
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <KAnonymityProgressDialog open progress={{ step: "submitting", completed: 6, total: 6, message: "x" }} onCancel={onCancel} />
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be cancelled now/)).toBeInTheDocument();
  });

  it("translates service steps into voter sentences", () => {
    expect(describeProgress(null)).toBe("Preparing your request");
    expect(describeProgress({ step: "encrypting", completed: 1, total: 6, message: "Computing XOR gate outputs..." })).toBe(
      "Hiding your request among 6 participants"
    );
    expect(describeProgress({ step: "proving", completed: 2, total: 6, message: "Generated 2 of 6 proofs..." })).toBe(
      "Building proof 3 of 6"
    );
    expect(describeProgress({ step: "submitting", completed: 6, total: 6, message: "" })).toBe("Sending your request");
  });
});
