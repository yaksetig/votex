import React, { useState } from "react";
import { Users, ShieldCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ElectionParticipant } from "@/services/electionParticipantsService";

interface DelegationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ElectionParticipant[];
  currentUserId: string;
  onDelegate: (participantIndex: number) => void;
  isProcessing: boolean;
}

/** Shorten a public key coordinate to a human-readable fingerprint. */
function fingerprint(pkX: string, pkY: string): string {
  const xTail = pkX.slice(-6);
  const yTail = pkY.slice(-6);
  return `${xTail}..${yTail}`;
}

const DelegationDialog: React.FC<DelegationDialogProps> = ({
  open,
  onOpenChange,
  participants,
  currentUserId,
  onDelegate,
  isProcessing,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Sort participants the same way the tally does (by joined_at) and
  // exclude the current user (can't delegate to yourself).
  const sorted = [...participants]
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

  const eligibleDelegates = sorted
    .map((p, index) => ({ ...p, originalIndex: index }))
    .filter((p) => p.participant_id !== currentUserId);

  const handleConfirm = () => {
    if (selectedIndex !== null) {
      onDelegate(selectedIndex);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5" />
          Delegate Your Vote
        </DialogTitle>
        <DialogDescription>
          Choose a registered participant to delegate your voting power to.
          Your delegation is encrypted — only the election authority can
          see who you delegated to, and the delegate will not know.
        </DialogDescription>

        {eligibleDelegates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No other participants have registered for this election yet.
            Check back later.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <Label>Select a delegate (identified by key fingerprint)</Label>
            <RadioGroup
              value={selectedIndex?.toString() ?? ""}
              onValueChange={(v) => setSelectedIndex(Number(v))}
              className="max-h-60 overflow-y-auto space-y-2"
            >
              {eligibleDelegates.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <RadioGroupItem
                    value={p.originalIndex.toString()}
                    id={`delegate-${p.originalIndex}`}
                  />
                  <Label
                    htmlFor={`delegate-${p.originalIndex}`}
                    className="flex-1 cursor-pointer font-mono text-sm"
                  >
                    Participant #{p.originalIndex + 1} &mdash;{" "}
                    {fingerprint(p.public_key_x, p.public_key_y)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIndex === null || isProcessing}
          >
            {isProcessing ? (
              "Encrypting..."
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Delegate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DelegationDialog;
