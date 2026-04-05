import React from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { KAnonymityProgress } from "@/services/kAnonymityNullificationService";

interface KAnonymityProgressDialogProps {
  open: boolean;
  progress: KAnonymityProgress | null;
}

const KAnonymityProgressDialog: React.FC<KAnonymityProgressDialogProps> = ({
  open,
  progress,
}) => {
  const percentage = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isComplete = progress?.step === "complete";

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md border-none bg-transparent p-0 shadow-none"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Generating Proofs</DialogTitle>
        <DialogDescription className="sr-only">
          Progress dialog for k-anonymity nullification proof generation.
        </DialogDescription>
        <div className="overflow-hidden rounded-[2rem] border border-outline-variant/12 bg-surface-container-lowest shadow-[0_30px_90px_rgba(0,20,54,0.22)]">
          <div className="p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="ledger-eyebrow">Cryptographic sealing in progress</p>
                <h3 className="mt-2 font-headline text-2xl font-extrabold text-primary">Generating Proofs</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-surface-container-high border-t-surface-tint">
                {isComplete ? (
                  <CheckCircle2 className="h-6 w-6 text-surface-tint" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-surface-tint" />
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em]">
                  <span className="text-on-surface">{progress?.message || "Preparing encrypted submissions..."}</span>
                  <span className="text-surface-tint">{percentage}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-surface-tint transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              <div className="rounded-[1.25rem] bg-surface-container-low p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-on-surface">Participant slots</span>
                  <span className="font-semibold text-surface-tint">
                    {progress?.completed || 0}/{progress?.total || 0}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
                  Your nullification request is being mixed with decoy proofs to preserve k-anonymity. Do not close this window while the sealing workflow completes.
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-[1.25rem] bg-primary-container px-4 py-3 text-on-primary">
              <ShieldCheck className="h-5 w-5 text-primary-fixed-dim" />
              <p className="text-sm leading-relaxed text-white/78">
                Multi-party proof generation is protecting the timing and meaning of this request.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KAnonymityProgressDialog;
