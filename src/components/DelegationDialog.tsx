import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, ShieldCheck, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ElectionParticipant } from "@/services/electionParticipantsService";
import { abbreviateIdentifier } from "@/lib/format";
import { howItWorksSection } from "@/lib/routes";
import { resolveDelegateIndex, sortParticipantsForDelegation } from "@/lib/delegationTargets";

interface DelegationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ElectionParticipant[];
  currentUserId: string;
  /** Receives the delegate's index in the joined_at-sorted participant list. */
  onDelegate: (participantIndex: number) => void;
  isProcessing: boolean;
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
  const [query, setQuery] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  // A fresh dialog each time: a stale selection from a previous visit would
  // otherwise be one click away from being encrypted and sent.
  useEffect(() => {
    if (open) {
      setSelectedIndex(null);
      setQuery("");
      setLookupError(null);
    }
  }, [open]);

  const sorted = useMemo(() => sortParticipantsForDelegation(participants), [participants]);
  const eligible = useMemo(
    () =>
      sorted
        .map((p, index) => ({ ...p, originalIndex: index }))
        .filter((p) => p.participant_id !== currentUserId),
    [sorted, currentUserId]
  );
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? eligible.filter(
        (p) =>
          p.participant_id.toLowerCase().includes(needle) ||
          p.public_key_x.toLowerCase().includes(needle) ||
          p.public_key_y.toLowerCase().includes(needle)
      )
    : eligible;

  const selected = selectedIndex === null ? null : sorted[selectedIndex];

  const handleConfirm = () => {
    if (selectedIndex !== null) {
      onDelegate(selectedIndex);
      return;
    }
    // Allow pasting a full pseudonym or key and confirming directly.
    const resolved = resolveDelegateIndex(sorted, query, currentUserId);
    if (resolved === null) {
      setLookupError(
        query.trim() === currentUserId
          ? "You cannot delegate to yourself."
          : "No registered participant in this election matches that pseudonym or key. Only people who have unlocked their voting key here can receive a delegation."
      );
      return;
    }
    onDelegate(resolved);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isProcessing && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline text-xl font-bold text-primary">
            <Users className="h-5 w-5" aria-hidden="true" />
            Delegate your ballot
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-on-surface-variant">
            Your ballot is counted as your delegate&apos;s choice. Everyone can see that you delegated; only the Election
            Authority learns to whom. Delegating registers your voting key for this election. Only one hop counts: if
            your delegate also delegates, neither ballot is counted.{" "}
            <Link to={howItWorksSection("delegation")} className="font-semibold text-secondary underline-offset-4 hover:underline">
              How delegation works
            </Link>
          </DialogDescription>
        </DialogHeader>

        {eligible.length === 0 ? (
          <p className="rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
            Nobody else has registered a voting key for this election yet, so there is no one to delegate to. Check back
            later.
          </p>
        ) : (
          <div className="space-y-3">
            <Label htmlFor="delegate-search" className="ledger-eyebrow">
              Find a participant by pseudonym or public key
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
              <Input
                id="delegate-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(null);
                  setLookupError(null);
                }}
                placeholder="Paste a pseudonym or public key"
                className="pl-9 font-mono text-sm"
                aria-describedby="delegate-search-hint"
                aria-invalid={lookupError ? true : undefined}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <p id="delegate-search-hint" className="text-xs text-on-surface-variant">
              Your delegate can copy their pseudonym from their profile page.
            </p>

            <RadioGroup
              value={selectedIndex?.toString() ?? ""}
              onValueChange={(value) => {
                setSelectedIndex(Number(value));
                setLookupError(null);
              }}
              aria-label="Participants"
              className="max-h-60 space-y-2 overflow-y-auto pr-1"
            >
              {filtered.length === 0 ? (
                <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">No participant matches.</p>
              ) : (
                filtered.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-outline-variant p-3 hover:bg-surface-container-low"
                  >
                    <RadioGroupItem value={p.originalIndex.toString()} id={`delegate-${p.originalIndex}`} />
                    <Label htmlFor={`delegate-${p.originalIndex}`} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
                      <span className="civic-mono truncate text-primary" title={p.participant_id}>
                        {abbreviateIdentifier(p.participant_id, 12)}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        Key {abbreviateIdentifier(p.public_key_x, 4)} · joined <time dateTime={p.joined_at}>{new Date(p.joined_at).toLocaleDateString()}</time>
                      </span>
                    </Label>
                  </div>
                ))
              )}
            </RadioGroup>

            {lookupError && (
              <p role="alert" className="text-sm font-medium text-error">
                {lookupError}
              </p>
            )}
            {selected && (
              <p className="text-sm text-on-surface-variant" aria-live="polite">
                Delegating to <span className="civic-mono text-primary">{abbreviateIdentifier(selected.participant_id, 8)}</span>.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            busy={isProcessing}
            aria-disabled={eligible.length === 0 || (selectedIndex === null && !query.trim()) || undefined}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            {isProcessing ? "Encrypting…" : "Delegate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DelegationDialog;
