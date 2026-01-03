import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Circle, AlertCircle } from "lucide-react";

export type ProofStep = 'idle' | 'loading' | 'witness' | 'proving' | 'complete' | 'error';

interface ZKProofProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStep: ProofStep;
  progress: number;
  errorMessage?: string;
  nullificationType?: 'actual' | 'dummy';
}

const STEPS = [
  { key: 'loading', label: 'Loading circuit files' },
  { key: 'witness', label: 'Computing witness' },
  { key: 'proving', label: 'Generating Groth16 proof' },
] as const;

const getStepIndex = (step: ProofStep): number => {
  switch (step) {
    case 'loading': return 0;
    case 'witness': return 1;
    case 'proving': return 2;
    case 'complete': return 3;
    default: return -1;
  }
};

const ZKProofProgressDialog: React.FC<ZKProofProgressDialogProps> = ({
  open,
  onOpenChange,
  currentStep,
  progress,
  errorMessage,
  nullificationType = 'actual',
}) => {
  const stepIndex = getStepIndex(currentStep);
  const isError = currentStep === 'error';
  const isComplete = currentStep === 'complete';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isError ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : isComplete ? (
              <Check className="h-5 w-5 text-primary" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {isError
              ? "Proof Generation Failed"
              : isComplete
              ? "Proof Generated"
              : "Generating Zero-Knowledge Proof"}
          </DialogTitle>
          <DialogDescription>
            {isError
              ? "An error occurred while generating the proof."
              : isComplete
              ? `Your ${nullificationType} nullification proof is ready.`
              : `Creating cryptographic proof for ${nullificationType} nullification...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress bar */}
          {!isError && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Step {Math.min(stepIndex + 1, 3)} of 3
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Step list */}
          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const isCurrentStep = stepIndex === index;
              const isCompletedStep = stepIndex > index || isComplete;
              const isPendingStep = stepIndex < index && !isComplete;

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 text-sm ${
                    isCurrentStep
                      ? "text-foreground font-medium"
                      : isCompletedStep
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {isCompletedStep ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : isCurrentStep ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Error message */}
          {isError && errorMessage && (
            <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Estimated time */}
          {!isError && !isComplete && (
            <p className="text-xs text-muted-foreground text-center">
              Estimated time: ~5-15 seconds
            </p>
          )}
        </div>

        {/* Footer */}
        {(isError || isComplete) && (
          <div className="flex justify-end">
            <Button
              variant={isError ? "outline" : "default"}
              onClick={() => onOpenChange(false)}
            >
              {isError ? "Close" : "Done"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ZKProofProgressDialog;
