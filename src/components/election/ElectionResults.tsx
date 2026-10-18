import { CheckCircle2, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { Time } from "@/components/Time";
import { formatPercentPair, pluralize } from "@/lib/format";
import { howItWorksSection } from "@/lib/routes";
import type { ElectionOutcome } from "@/lib/electionResults";
import { cn } from "@/lib/utils";

interface ElectionResultsProps {
  options: [string, string];
  outcome: ElectionOutcome;
  /** When the tally ran; shown only for `tallied` outcomes. */
  talliedAt?: string | null;
  /** Compact layout for the sidebar while voting is open. */
  compact?: boolean;
}

const HEADINGS = {
  running: "Running count",
  preliminary: "Preliminary result",
  tallied: "Final result",
} as const;

/**
 * Renders the count for both options and says exactly what kind of number
 * it is: a running count, a preliminary result that the Election Authority
 * has not tallied yet, or the final tallied result.
 */
export function ElectionResults({ options, outcome, talliedAt, compact = false }: ElectionResultsProps) {
  const { counts, kind, leader, tie } = outcome;
  const [percentA, percentB] = formatPercentPair(counts.option1, counts.option2);
  const unit = kind === "tallied" ? "weighted ballot" : "ballot";

  return (
    <section
      aria-labelledby="results-heading"
      className={cn("ledger-panel", compact ? "p-5" : "p-5 sm:p-6 md:p-8")}
      data-results-kind={kind}
    >
      <div className="flex flex-col gap-2">
        <h2 id="results-heading" className={cn("font-headline font-bold text-primary", compact ? "text-lg" : "text-xl sm:text-2xl")}>
          {HEADINGS[kind]}
        </h2>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          {kind === "running" &&
            "Ballots as cast so far. Nullifications and delegations are only resolved when the election closes and the Election Authority runs the tally."}
          {kind === "preliminary" && (
            <>
              Ballots as cast. The Election Authority has not run the tally yet, so nullified ballots and delegated weights
              are not reflected. <Link to={howItWorksSection("nullification")} className="font-semibold text-secondary underline-offset-4 hover:underline">What the tally changes</Link>
            </>
          )}
          {kind === "tallied" && talliedAt && (
            <>
              Tallied on <Time value={talliedAt} />. Nullified ballots were removed and delegated ballots counted for their delegate.
            </>
          )}
          {kind === "tallied" && !talliedAt && "Nullified ballots were removed and delegated ballots counted for their delegate."}
        </p>
      </div>

      <div className={cn("mt-6 grid gap-4", compact ? "" : "sm:grid-cols-2")}>
        {options.map((option, index) => {
          const count = index === 0 ? counts.option1 : counts.option2;
          const percent = index === 0 ? percentA : percentB;
          const leads = leader === index;
          return (
            <div
              key={`${index}-${option}`}
              className={cn(
                "rounded-xl border p-5",
                leads && kind !== "running" ? "border-surface-tint bg-primary-fixed" : "border-outline-variant bg-surface-container-lowest"
              )}
            >
              <span className="ledger-eyebrow">Option {index === 0 ? "A" : "B"}</span>
              <h3 className={cn("mt-2 font-headline font-bold text-primary", compact ? "text-lg" : "text-2xl")}>{option}</h3>
              <div className="mt-4 space-y-2">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm text-on-surface-variant">{pluralize(count, unit)}</span>
                  <span className="font-headline text-2xl font-extrabold tabular-nums text-surface-tint">
                    {counts.total > 0 ? `${percent}%` : "—"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-container-high" aria-hidden="true">
                  <div className="h-full rounded-full bg-surface-tint motion-safe:transition-all" style={{ width: `${counts.total > 0 ? percent : 0}%` }} />
                </div>
              </div>
              {leads && kind === "tallied" && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Winner
                </p>
              )}
              {leads && kind === "preliminary" && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
                  Leading before tally
                </p>
              )}
            </div>
          );
        })}
      </div>

      {tie && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
          <Scale className="h-3 w-3" aria-hidden="true" />
          {kind === "tallied" ? "Tie" : "Tied so far"}
        </p>
      )}

      {!compact && (
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          {pluralize(counts.total, unit)} {kind === "tallied" ? "counted" : "recorded"}
        </p>
      )}
    </section>
  );
}
