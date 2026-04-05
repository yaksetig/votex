import React from "react";
import { ShieldCheck, Ghost, TriangleAlert, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface NullificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActualNullification: () => void;
  onDummyNullification: () => void;
  isProcessing: boolean;
}

const NullificationDialog: React.FC<NullificationDialogProps> = ({
  open,
  onOpenChange,
  onActualNullification,
  onDummyNullification,
  isProcessing,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Nullification Options</DialogTitle>
        <DialogDescription className="sr-only">
          Choose between an actual nullification and a dummy nullification. Both
          flows look the same to outside observers.
        </DialogDescription>
        <div className="rounded-[2rem] border border-outline-variant/12 bg-surface-container-lowest p-8 shadow-[0_30px_90px_rgba(0,20,54,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-error-container px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-on-error-container">
                <TriangleAlert className="h-4 w-4" />
                Coercion resistance
              </div>
              <h2 className="mt-4 font-headline text-3xl font-extrabold text-primary">Nullification Options</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                Both actions generate the same observable workflow. Choose the real nullification if you need to invalidate your ballot, or the dummy path if you need plausible deniability.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={onActualNullification}
              disabled={isProcessing}
              className="group rounded-[1.75rem] border border-outline-variant/16 bg-surface-container-low p-8 text-left transition-all hover:border-surface-tint/35"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="mt-5 font-headline text-2xl font-bold text-primary">Actual Nullification</h3>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                Encrypts a real nullification value and proves you hold the correct private key for this ballot.
              </p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
                Type-0 protocol
              </p>
            </button>

            <button
              type="button"
              onClick={onDummyNullification}
              disabled={isProcessing}
              className="group rounded-[1.75rem] border border-outline-variant/16 bg-surface-container-low p-8 text-left transition-all hover:border-surface-tint/35"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Ghost className="h-8 w-8" />
              </div>
              <h3 className="mt-5 font-headline text-2xl font-bold text-primary">Dummy Nullification</h3>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                Runs the same encrypted and zero-knowledge flow, but submits a harmless decoy value instead of invalidating the ballot.
              </p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-outline">
                Type-0 protocol
              </p>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NullificationDialog;
