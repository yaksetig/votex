import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Lock,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ElectionTallyResult, processElectionTally } from "@/services/tallyService";

interface ElectionAuthorityInterfaceProps {
  electionId: string;
  electionTitle: string;
  onTallyComplete?: (results: ElectionTallyResult) => void;
}

const ElectionAuthorityInterface: React.FC<ElectionAuthorityInterfaceProps> = ({
  electionId,
  electionTitle,
  onTallyComplete = () => {},
}) => {
  const [privateKey, setPrivateKey] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tallyResults, setTallyResults] = useState<ElectionTallyResult | null>(null);
  const { toast } = useToast();

  const stats = useMemo(() => {
    if (!tallyResults) {
      return null;
    }

    const totalVoters = tallyResults.results.length;
    const nullifiedVotes = tallyResults.results.filter(
      (result) => result.voteNullified
    ).length;
    const totalNullifications = tallyResults.results.reduce(
      (sum, result) => sum + result.nullificationCount,
      0
    );

    return { nullifiedVotes, totalNullifications, totalVoters };
  }, [tallyResults]);

  const handleProcessTally = async () => {
    if (!privateKey.trim()) {
      setError("Enter the authority private key to process the tally.");
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);

      const results = await processElectionTally(
        electionId,
        privateKey.trim(),
        "Election Authority"
      );

      if (!results) {
        throw new Error("Failed to process election tally");
      }

      setTallyResults(results);
      onTallyComplete(results);
      toast({
        title: "Tally processed",
        description: `Resolved ${results.results.length} voter records for ${electionTitle}.`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown tally processing error";
      setError(message);
      toast({
        variant: "destructive",
        title: "Tally processing failed",
        description: message,
      });
    } finally {
      setIsProcessing(false);
      setPrivateKey("");
    }
  };

  if (tallyResults && stats) {
    return (
      <div className="space-y-8">
        <section className="rounded-[2rem] bg-primary-container p-8 text-on-primary shadow-ledger-lg">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-primary-fixed-dim">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <p className="ledger-eyebrow text-on-primary-container">Tally complete</p>
              <h2 className="mt-2 font-headline text-3xl font-extrabold text-white">
                Final decryption finished successfully
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/76">
                The authority key resolved the nullification accumulators and persisted the final tally ledger on{" "}
                {new Date(tallyResults.processedAt).toLocaleString()}.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="ledger-subpanel">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div className="mt-5 font-headline text-4xl font-extrabold text-primary">
              {stats.totalVoters}
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Total Voters
            </p>
          </div>
          <div className="ledger-subpanel">
            <AlertTriangle className="h-6 w-6 text-tertiary-container" />
            <div className="mt-5 font-headline text-4xl font-extrabold text-tertiary-container">
              {stats.nullifiedVotes}
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Nullified Votes
            </p>
          </div>
          <div className="ledger-subpanel">
            <Calculator className="h-6 w-6 text-secondary" />
            <div className="mt-5 font-headline text-4xl font-extrabold text-secondary">
              {stats.totalNullifications}
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Total Nullifications
            </p>
          </div>
        </section>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setError(null);
            setTallyResults(null);
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Process Another Tally
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-primary-container p-8 text-on-primary shadow-ledger-lg">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-primary-fixed-dim">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <p className="ledger-eyebrow text-on-primary-container">Authority-only operation</p>
            <h2 className="mt-2 font-headline text-3xl font-extrabold text-white">
              Process the final tally for {electionTitle}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/76">
              Enter the authority private key to decrypt the nullification accumulators, resolve final ballot validity, and write the official result set.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_360px]">
        <div className="ledger-subpanel">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <p className="ledger-eyebrow">Step 1</p>
              <h3 className="mt-1 font-headline text-2xl font-bold text-primary">
                Decrypt authority accumulators
              </h3>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-on-surface-variant">
            The private key is used locally to decrypt per-voter XOR accumulators. The browser clears the entered value immediately after processing completes or fails.
          </p>

          <label htmlFor="privateKey" className="ledger-eyebrow mt-8 block">
            Authority private key
          </label>
          <Input
            id="privateKey"
            type="password"
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            placeholder="Enter the authority private key"
            className="mt-3"
            disabled={isProcessing}
          />

          {error && (
            <div className="mt-5 rounded-[1.25rem] border border-error/20 bg-error-container/70 p-4 text-sm text-on-error-container">
              {error}
            </div>
          )}

          <Button
            onClick={handleProcessTally}
            disabled={isProcessing || !privateKey.trim()}
            className="mt-6 w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Calculator className="h-4 w-4 animate-spin" />
                Processing Tally...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Begin Tally Processing
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <div className="ledger-subpanel">
            <p className="ledger-eyebrow">Security note</p>
            <h3 className="mt-3 font-headline text-2xl font-bold text-primary">
              Private key use is local-only
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              The authority key is not stored in the browser or sent to the server. Only the resulting tally rows are persisted through the authenticated write path.
            </p>
          </div>

          <div className="ledger-subpanel">
            <p className="ledger-eyebrow">Processing sequence</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[1.25rem] bg-surface-container-high p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Step 1
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Decrypt XOR accumulators.
                </p>
              </div>
              <div className="rounded-[1.25rem] bg-surface-container-high p-4 opacity-80">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Step 2
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Resolve final ballot validity.
                </p>
              </div>
              <div className="rounded-[1.25rem] bg-surface-container-high p-4 opacity-70">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Step 3
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Persist signed tally results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ElectionAuthorityInterface;
