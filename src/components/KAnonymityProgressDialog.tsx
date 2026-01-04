import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Shield, Lock, CheckCircle } from "lucide-react";
import { KAnonymityProgress } from "@/services/kAnonymityNullificationService";

interface KAnonymityProgressDialogProps {
  open: boolean;
  progress: KAnonymityProgress | null;
}

const stepMessages = {
  preparing: "Preparing privacy-preserving nullifications...",
  encrypting: "Encrypting nullification data...",
  proving: "Generating zero-knowledge proofs...",
  complete: "All proofs generated successfully!",
};

const KAnonymityProgressDialog: React.FC<KAnonymityProgressDialogProps> = ({
  open,
  progress,
}) => {
  const percentage = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isComplete = progress?.step === "complete";

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Shield className="h-5 w-5 text-primary animate-pulse" />
            )}
            Privacy-Preserving Nullification
          </DialogTitle>
          <DialogDescription>
            Generating {progress?.total || 6} nullifications for k-anonymity protection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {progress?.message || "Initializing..."}
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Step indicators */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className={`flex items-center gap-1 ${
              progress?.step === "preparing" || progress?.step === "encrypting" || 
              progress?.step === "proving" || progress?.step === "complete" 
                ? "text-primary" : ""
            }`}>
              <Lock className="h-3 w-3" />
              <span>Prepare</span>
            </div>
            <div className={`flex items-center gap-1 ${
              progress?.step === "encrypting" || progress?.step === "proving" || 
              progress?.step === "complete" 
                ? "text-primary" : ""
            }`}>
              <Lock className="h-3 w-3" />
              <span>Encrypt</span>
            </div>
            <div className={`flex items-center gap-1 ${
              progress?.step === "proving" || progress?.step === "complete" 
                ? "text-primary" : ""
            }`}>
              <Shield className="h-3 w-3" />
              <span>Prove ({progress?.completed || 0}/{progress?.total || 0})</span>
            </div>
            <div className={`flex items-center gap-1 ${
              progress?.step === "complete" ? "text-green-500" : ""
            }`}>
              <CheckCircle className="h-3 w-3" />
              <span>Done</span>
            </div>
          </div>

          {/* Info text */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            {progress?.step === "proving" ? (
              <>Using parallel processing for faster proof generation</>
            ) : isComplete ? (
              <>Storing nullifications to blockchain...</>
            ) : (
              <>Your nullification will be hidden among {progress?.total || 6} decoy nullifications</>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KAnonymityProgressDialog;
