import React from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { KAnonymityProgress } from "@/services/kAnonymityNullificationService";
import { describeProgress } from "@/lib/nullificationCopy";

interface KAnonymityProgressDialogProps {
  open: boolean;
  progress: KAnonymityProgress | null;
  /** Called when the voter cancels; only offered before submission starts. */
  onCancel?: () => void;
}

const KAnonymityProgressDialog: React.FC<KAnonymityProgressDialogProps> = ({ open, progress, onCancel }) => {
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? 0;
  const determinate = total > 0;
  const percentage = determinate ? Math.round((Math.min(completed, total) / total) * 100) : 0;
  const isSubmitting = progress?.step === "submitting";
  const isComplete = progress?.step === "complete";
  const canCancel = Boolean(onCancel) && !isSubmitting;
  const label = describeProgress(progress);

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        hideClose
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="ledger-eyebrow">Nullification request</p>
            <DialogTitle className="mt-2 font-headline text-2xl font-bold text-primary">
              {isSubmitting ? "Sending" : "Preparing"}
            </DialogTitle>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-surface-container-high border-t-surface-tint" aria-hidden="true">
            {isComplete || isSubmitting ? (
              <CheckCircle2 className="h-6 w-6 text-surface-tint" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-surface-tint" />
            )}
          </div>
        </div>
        <DialogDescription className="text-sm leading-relaxed text-on-surface-variant">
          This keeps the tab busy for a short while. Nothing is sent until the last step, and nothing on this screen is
          recorded.
        </DialogDescription>

        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-on-surface">
              <span role="status" aria-live="polite" aria-atomic="true">
                {label}
                {label.endsWith(".") ? "" : "…"}
              </span>
              {determinate && <span className="tabular-nums text-surface-tint">{percentage}%</span>}
            </div>
            <div
              role="progressbar"
              aria-label="Nullification request progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={determinate ? percentage : undefined}
              aria-valuetext={determinate ? `${percentage}%` : "Working"}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
            >
              <div
                className={determinate ? "h-full rounded-full bg-secondary motion-safe:transition-all motion-safe:duration-500" : "h-full w-1/3 rounded-full bg-secondary motion-safe:animate-pulse"}
                style={determinate ? { width: `${percentage}%` } : undefined}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-surface-tint" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {total === 1
                ? "No other participants have registered yet, so this request is not hidden among others. It is still encrypted."
                : total > 1
                  ? `Your request is sent together with ${total - 1} decoy ${total - 1 === 1 ? "slot" : "slots"}, so it looks the same whether it is real or a decoy.`
                  : "Your request will be sent together with decoy slots so it looks the same whether it is real or a decoy."}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          {canCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <p className="text-xs text-on-surface-variant" role="status">
              {isSubmitting ? "Sending. This cannot be cancelled now." : ""}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KAnonymityProgressDialog;
