import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TallyResult } from "@/services/tallyService";
import { getNullificationsForElection } from "@/services/nullificationService";
import { getElectionTallyResults } from "@/services/tallyService";
import type { VoteData } from "@/services/voteTrackingService";
import { getElectionVoteData } from "@/services/voteTrackingService";
import type { TallyChartDatum } from "@/components/TallyResultsChart";
import { Time } from "@/components/Time";
import { Skeleton } from "@/components/Skeleton";
import { StatusPill } from "@/components/StatusPill";
import { abbreviateIdentifier, pluralize } from "@/lib/format";

const TallyResultsChart = lazy(() => import("@/components/TallyResultsChart"));

interface TallyResultsDisplayProps {
  electionId: string;
  electionTitle: string;
  option1Name: string;
  option2Name: string;
  electionClosed: boolean;
}

const TABLE_PAGE = 12;

/**
 * The operator's overview: ballots as cast, and (only once a tally ran) the
 * tallied result with nullified ballots removed and weights applied. Before
 * a tally there is no "final" series to show, so none is drawn.
 */
const TallyResultsDisplay: React.FC<TallyResultsDisplayProps> = ({ electionId, electionTitle, option1Name, option2Name, electionClosed }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());
  const [tallyResults, setTallyResults] = useState<TallyResult[]>([]);
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [tableLimit, setTableLimit] = useState(TABLE_PAGE);

  const fetchTallyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const [tallyData, voteTrackingData, nullificationData] = await Promise.all([
        getElectionTallyResults(electionId),
        getElectionVoteData(electionId),
        getNullificationsForElection(electionId),
      ]);
      setTallyResults(tallyData);
      setVoteData(voteTrackingData);
      setRequestCount(nullificationData.length);
      setRefreshedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    void fetchTallyData();
  }, [fetchTallyData]);

  const tallied = tallyResults.length > 0;
  const talliedAt = tallyResults.find((row) => row.processedAt)?.processedAt ?? null;

  const stats = useMemo(() => {
    const totalBallots = voteData ? voteData.totalYesVotes + voteData.totalNoVotes : 0;
    const nullifiedBallots = tallyResults.filter((row) => row.voteNullified).length;
    return { totalBallots, nullifiedBallots, requestCount };
  }, [requestCount, tallyResults, voteData]);

  const chartData = useMemo<TallyChartDatum[]>(() => {
    if (!voteData) return [];
    const series: TallyChartDatum[] = [
      { name: "Ballots as cast", [option1Name]: voteData.totalYesVotes, [option2Name]: voteData.totalNoVotes },
    ];
    if (tallied) {
      series.push({ name: "Tallied result", [option1Name]: voteData.validYesVotes, [option2Name]: voteData.validNoVotes });
    }
    return series;
  }, [option1Name, option2Name, tallied, voteData]);

  if (loading && !voteData) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" label="Loading results" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-[24rem]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error/30 bg-error-container p-6 text-on-error-container" role="alert">
        <p className="font-semibold">The results could not be loaded.</p>
        <Button variant="outline" className="mt-3" onClick={() => void fetchTallyData()}>
          Retry
        </Button>
      </div>
    );
  }

  const chartDescription = tallied
    ? `${electionTitle}: as cast, ${option1Name} ${voteData?.totalYesVotes ?? 0} and ${option2Name} ${voteData?.totalNoVotes ?? 0}; tallied, ${option1Name} ${voteData?.validYesVotes ?? 0} and ${option2Name} ${voteData?.validNoVotes ?? 0}.`
    : `${electionTitle}: ballots as cast, ${option1Name} ${voteData?.totalYesVotes ?? 0} and ${option2Name} ${voteData?.totalNoVotes ?? 0}.`;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ledger-eyebrow">Overview</p>
          <h2 className="mt-2 font-headline text-2xl font-bold text-primary">Results</h2>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            {tallied ? (
              <>
                Tallied on <Time value={talliedAt ?? refreshedAt} />. Nullified ballots were removed and delegated weights applied.
              </>
            ) : electionClosed ? (
              "Ballots as cast. Run the tally to resolve nullifications and delegations and publish the result."
            ) : (
              "Ballots as cast so far. The tally becomes available once the election closes."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill lifecycle={!electionClosed ? "open" : tallied ? "tallied" : "tally_pending"} />
          <Button onClick={() => void fetchTallyData()} variant="outline" busy={loading}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      <dl className="grid gap-4 md:grid-cols-3">
        <div className="ledger-subpanel">
          <dt className="ledger-eyebrow">Ballots cast</dt>
          <dd className="mt-3 font-headline text-4xl font-extrabold tabular-nums text-primary">{stats.totalBallots}</dd>
        </div>
        <div className="ledger-subpanel">
          <dt className="ledger-eyebrow">Nullification requests</dt>
          <dd className="mt-3 font-headline text-4xl font-extrabold tabular-nums text-secondary">
            {stats.requestCount}
            <span className="mt-2 block font-body text-xs font-normal leading-relaxed text-on-surface-variant">
              Includes decoys. Real and decoy requests are indistinguishable until the tally.
            </span>
          </dd>
        </div>
        <div className="ledger-subpanel">
          <dt className="ledger-eyebrow">Ballots nullified</dt>
          <dd className="mt-3 font-headline text-4xl font-extrabold tabular-nums text-primary">
            {tallied ? stats.nullifiedBallots : "—"}
            <span className="mt-2 block font-body text-xs font-normal leading-relaxed text-on-surface-variant">{tallied ? "Resolved by the tally." : "Known after the tally."}</span>
          </dd>
        </div>
      </dl>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="ledger-subpanel min-h-[24rem]">
          <h3 className="font-headline text-xl font-bold text-primary">Distribution</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            {tallied ? "Ballots as cast next to the tallied result." : "Ballots as cast. The tallied series appears after the tally."}
          </p>
          <div className="mt-6 h-[320px]">
            {chartData.length > 0 && stats.totalBallots > 0 ? (
              <Suspense fallback={<Skeleton className="h-full" />}>
                <TallyResultsChart chartData={chartData} option1Name={option1Name} option2Name={option2Name} description={chartDescription} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-center">
                <p className="text-sm text-on-surface-variant">No ballots yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-primary-container p-6 text-on-primary shadow-ledger-lg">
          <p className="ledger-eyebrow text-white/70">{tallied ? "Tallied result" : "As cast"}</p>
          <dl className="mt-5 space-y-5 text-sm">
            {[
              { name: option1Name, cast: voteData?.totalYesVotes ?? 0, tallied: voteData?.validYesVotes ?? 0 },
              { name: option2Name, cast: voteData?.totalNoVotes ?? 0, tallied: voteData?.validNoVotes ?? 0 },
            ].map((option) => (
              <div key={option.name} className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-white">{option.name}</dt>
                <dd className="text-right">
                  <span className="font-headline text-2xl font-bold tabular-nums text-white">{tallied ? option.tallied : option.cast}</span>
                  {tallied && <span className="block text-white/80">As cast: {option.cast}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-white/80">
            Last refreshed <Time value={refreshedAt} />
          </p>
        </div>
      </section>

      {tallied && (
        <section className="ledger-subpanel overflow-hidden" aria-labelledby="tally-table-title">
          <div className="flex flex-col gap-2 border-b border-outline-variant pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ledger-eyebrow">Per voter</p>
              <h3 id="tally-table-title" className="mt-2 font-headline text-xl font-bold text-primary">
                Tally rows
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              Showing {Math.min(tableLimit, tallyResults.length)} of {pluralize(tallyResults.length, "row")}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Tally rows table">
            <table className="min-w-full text-left">
              <caption className="sr-only">Per-voter tally outcome</caption>
              <thead className="text-xs font-semibold text-on-surface-variant">
                <tr>
                  <th scope="col" className="pb-3 pr-6">Pseudonym</th>
                  <th scope="col" className="pb-3 pr-6">Requests</th>
                  <th scope="col" className="pb-3 pr-6">Weight</th>
                  <th scope="col" className="pb-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {tallyResults.slice(0, tableLimit).map((result) => (
                  <tr key={result.userId}>
                    <td className="py-3 pr-6 font-mono text-xs text-on-surface-variant" title={result.userId}>
                      {abbreviateIdentifier(result.userId, 10)}
                    </td>
                    <td className="py-3 pr-6 tabular-nums text-primary">{result.nullificationCount}</td>
                    <td className="py-3 pr-6 tabular-nums text-primary">{result.voteWeight}</td>
                    <td className="py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                          result.voteNullified ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container",
                        ].join(" ")}
                      >
                        {result.voteNullified ? "Nullified" : "Counted"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tallyResults.length > tableLimit && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" onClick={() => setTableLimit((current) => current + TABLE_PAGE)}>
                Show {Math.min(TABLE_PAGE, tallyResults.length - tableLimit)} more
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default TallyResultsDisplay;
