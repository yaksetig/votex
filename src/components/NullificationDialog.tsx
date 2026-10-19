import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { howItWorksSection } from "@/lib/routes";

interface NullificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActualNullification: () => void;
  onDummyNullification: () => void;
  isProcessing: boolean;
}

/**
 * The two choices are rendered identically on purpose: same icon, same
 * styling, same weight. Anyone looking at the screen must not be able to
 * tell which one the voter is about to pick, and nothing here is recorded.
 */
const NullificationDialog: React.FC<NullificationDialogProps> = ({
  open,
  onOpenChange,
  onActualNullification,
  onDummyNullification,
  isProcessing,
}) => {
  const choices = [
    {
      key: "real",
      title: "Nullify my ballot",
      body: "Removes your ballot from the count at the tally. You will not be able to cast a new ballot in this election.",
      onSelect: onActualNullification,
    },
    {
      key: "decoy",
      title: "Send a decoy",
      body: "Changes nothing about your ballot. Decoys are what keep real nullifications hidden, so sending one helps every voter.",
      onSelect: onDummyNullification,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !isProcessing && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl font-bold text-primary">Submit a nullification request</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-on-surface-variant">
            Both requests look identical to Votex, to observers and to anyone watching this screen. Only the Election
            Authority learns the outcome, at the tally. Nothing you choose here is recorded; only the encrypted request is
            published. You can send as many requests as you like until the election closes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Request type">
          {choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={choice.onSelect}
              aria-disabled={isProcessing || undefined}
              className="group flex min-h-44 flex-col rounded-xl border border-outline-variant bg-surface-container-low p-5 text-left transition-colors hover:border-surface-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 aria-disabled:cursor-progress"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white" aria-hidden="true">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="mt-4 font-headline text-xl font-bold text-primary">{choice.title}</span>
              <span className="mt-2 text-sm leading-relaxed text-on-surface-variant">{choice.body}</span>
            </button>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-on-surface-variant">
          If you were pressured to vote a certain way, read{" "}
          <Link to={howItWorksSection("pressure")} className="font-semibold text-secondary underline-offset-4 hover:underline">
            what to do
          </Link>{" "}
          first.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default NullificationDialog;
