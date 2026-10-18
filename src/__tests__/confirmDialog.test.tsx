/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function Harness({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Close election
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Close this election early?"
        description="Voters lose the remaining nullification window."
        confirmLabel="Close election now"
        destructive
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("is an alertdialog that focuses the confirm button and names the consequence", async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Close election" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Close this election early?" });
    expect(dialog).toHaveTextContent("Voters lose the remaining nullification window.");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close election now" })).toHaveFocus();
    });
  });

  it("runs the action on confirm and returns focus to the trigger on cancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Close election" });

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Close election now" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape without confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Close election" }));
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
