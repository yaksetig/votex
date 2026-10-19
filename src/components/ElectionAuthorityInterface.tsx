import React, { useState } from "react";
import { Calculator, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ElectionTallyResult, processElectionTally } from "@/services/tallyService";
import { describeTallyError } from "@/lib/tallyErrors";

interface ElectionAuthorityInterfaceProps {
  electionId: string;
  electionTitle: string;
  /** Recorded as processed_by on the tally rows. */
  operatorName: string;
  /** True when a tally already exists and this run replaces it. */
  replaceExisting?: boolean;
  onTallyComplete: (results: ElectionTallyResult) => void;
}

/**
 * The tally form only. The result of a run is shown by the dashboard, which
 * keeps it mounted after completion; this component owns nothing but the
 * secret field, the busy state and the error.
 */
const ElectionAuthorityInterface: React.FC<ElectionAuthorityInterfaceProps> = ({
  electionId,
  electionTitle,
  operatorName,
  replaceExisting = false,
  onTallyComplete,
}) => {
  const [authoritySecret, setAuthoritySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleProcessTally = async () => {
    if (!authoritySecret.trim()) {
      setError("Enter the authority secret to run the tally.");
      return;
    }
    try {
      setError(null);
      setIsProcessing(true);
      const results = await processElectionTally(electionId, authoritySecret.trim(), operatorName, replaceExisting);
      // Only a successful run clears the secret; a typo should not cost a retype.
      setAuthoritySecret("");
      toast({ key: "tally", title: "Tally processed", description: `${electionTitle}: ${results.results.length} voter records resolved.` });
      onTallyComplete(results);
    } catch (err) {
      const failure = describeTallyError(err);
      setError(failure.message);
      if (!failure.keepSecret) setAuthoritySecret("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-primary p-6 text-on-primary sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-primary-fixed-dim">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="ledger-eyebrow text-white/70">{replaceExisting ? "Replacement run" : "Election Authority only"}</p>
            <h2 className="mt-2 font-headline text-2xl font-semibold text-white">
              {replaceExisting ? `Run the tally again for ${electionTitle}` : `Run the tally for ${electionTitle}`}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/85">
              The secret derives the authority key in this browser, decrypts each voter&apos;s nullification state,
              resolves delegations, and publishes the result. The key is never sent to Votex or stored.
              {replaceExisting ? " This run replaces the published result; the previous run stays in the audit record." : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_320px]">
        <div className="ledger-subpanel">
          <label htmlFor="authoritySecret" className="ledger-eyebrow block">
            Authority secret
          </label>
          <div className="relative mt-3">
            <Input
              id="authoritySecret"
              type={showSecret ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={authoritySecret}
              onChange={(event) => setAuthoritySecret(event.target.value)}
              placeholder="votex-auth-v1_…"
              className="pr-12 font-mono"
              disabled={isProcessing}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "tally-error" : "tally-hint"}
            />
            <button
              type="button"
              onClick={() => setShowSecret((current) => !current)}
              aria-label={showSecret ? "Hide secret" : "Show secret"}
              aria-pressed={showSecret}
              className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              {showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <p id="tally-hint" className="mt-2 text-xs text-on-surface-variant">
            The recovery key from the authority set-up. It is cleared from this field once the tally succeeds.
          </p>

          {error && (
            <div id="tally-error" role="alert" className="mt-5 rounded-lg border border-error/20 bg-error-container p-4 text-sm text-on-error-container">
              {error}
            </div>
          )}

          <Button onClick={() => void handleProcessTally()} busy={isProcessing} className="mt-6 w-full" size="lg" aria-disabled={!authoritySecret.trim() || undefined}>
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Calculator className="h-4 w-4" aria-hidden="true" />}
            {isProcessing ? "Running tally…" : "Run tally"}
          </Button>
          <p className="mt-3 min-h-5 text-sm text-on-surface-variant" role="status" aria-live="polite">
            {isProcessing ? "Decrypting nullification states and resolving delegations. This can take a minute; keep this tab open." : ""}
          </p>
        </div>

        <div className="ledger-subpanel">
          <p className="ledger-eyebrow">What happens</p>
          <ol className="mt-4 space-y-3 text-sm text-on-surface-variant">
            <li className="rounded-lg bg-surface-container-high p-3">
              <span className="font-semibold text-primary">1.</span> The authority key is derived and checked against the key registered for this election.
            </li>
            <li className="rounded-lg bg-surface-container-high p-3">
              <span className="font-semibold text-primary">2.</span> Each voter&apos;s nullification state is decrypted; nullified ballots are dropped.
            </li>
            <li className="rounded-lg bg-surface-container-high p-3">
              <span className="font-semibold text-primary">3.</span> Delegations are opened and weights applied; the result is published.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
};

export default ElectionAuthorityInterface;
