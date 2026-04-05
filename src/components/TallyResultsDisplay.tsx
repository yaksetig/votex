import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getElectionTallyResults, TallyResult } from "@/services/tallyService";
import { getNullificationsForElection } from "@/services/nullificationService";
import { getElectionVoteData, VoteData } from "@/services/voteTrackingService";

interface TallyResultsDisplayProps {
  electionId: string;
  electionTitle: string;
  option1Name: string;
  option2Name: string;
}

const TallyResultsDisplay: React.FC<TallyResultsDisplayProps> = ({
  electionId,
  electionTitle,
  option1Name,
  option2Name,
}) => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tallyResults, setTallyResults] = useState<TallyResult[]>([]);
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [totalNullifications, setTotalNullifications] = useState(0);

  const fetchTallyData = async () => {
    try {
      setLoading(true);

      const [tallyData, voteTrackingData, nullificationData] = await Promise.all([
        getElectionTallyResults(electionId),
        getElectionVoteData(electionId),
        getNullificationsForElection(electionId),
      ]);

      setTallyResults(tallyData);
      setVoteData(voteTrackingData);
      setTotalNullifications(nullificationData.length);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTallyData();
  }, [electionId]);

  const stats = useMemo(() => {
    if (!voteData) {
      return {
        totalVotes: 0,
        validVotes: 0,
        nullifiedVotes: 0,
        totalNullifications: totalNullifications,
      };
    }

    return {
      totalVotes: voteData.totalYesVotes + voteData.totalNoVotes,
      validVotes: voteData.validYesVotes + voteData.validNoVotes,
      nullifiedVotes: voteData.nullifiedYesVotes + voteData.nullifiedNoVotes,
      totalNullifications,
    };
  }, [totalNullifications, voteData]);

  const chartData = useMemo(() => {
    if (!voteData) {
      return [];
    }

    return [
      {
        name: "Preliminary",
        [option1Name]: voteData.totalYesVotes,
        [option2Name]: voteData.totalNoVotes,
      },
      {
        name: "Final",
        [option1Name]: voteData.validYesVotes,
        [option2Name]: voteData.validNoVotes,
      },
    ];
  }, [option1Name, option2Name, voteData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="ledger-subpanel h-28 animate-pulse" />
          <div className="ledger-subpanel h-28 animate-pulse" />
          <div className="ledger-subpanel h-28 animate-pulse" />
          <div className="ledger-subpanel h-28 animate-pulse" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="ledger-subpanel h-[24rem] animate-pulse" />
          <div className="ledger-subpanel h-[24rem] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ledger-eyebrow">Overview & results</p>
          <h2 className="mt-2 font-headline text-3xl font-extrabold text-primary">
            {electionTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            Compare preliminary totals with post-nullification results and inspect the voter-level tally ledger when available.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={tallyResults.length > 0 ? "default" : "secondary"}>
            {tallyResults.length > 0 ? "Tally Processed" : "Vote Tracking Active"}
          </Badge>
          <Button onClick={fetchTallyData} variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Votes",
            value: stats.totalVotes,
            icon: Users,
            tone: "text-primary",
          },
          {
            label: "Valid Votes",
            value: stats.validVotes,
            icon: CheckCircle2,
            tone: "text-surface-tint",
          },
          {
            label: "Nullified Votes",
            value: stats.nullifiedVotes,
            icon: ShieldCheck,
            tone: "text-tertiary-container",
          },
          {
            label: "Nullification Events",
            value: stats.totalNullifications,
            icon: BarChart3,
            tone: "text-secondary",
          },
        ].map(({ icon: Icon, label, tone, value }) => (
          <div key={label} className="ledger-subpanel">
            <Icon className={`h-6 w-6 ${tone}`} />
            <div className={`mt-5 font-headline text-4xl font-extrabold ${tone}`}>
              {value}
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="ledger-subpanel min-h-[24rem]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-headline text-2xl font-bold text-primary">
                Live Distribution
              </h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                Preliminary vote totals vs final results after nullification processing.
              </p>
            </div>
            <Badge variant="outline">Two-phase tally</Badge>
          </div>

          <div className="mt-8 h-[320px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#d9dce2" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#44474c", fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#74777d", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0, 90, 194, 0.06)" }}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(196, 198, 205, 0.5)",
                      boxShadow: "0 18px 48px rgba(0, 20, 54, 0.08)",
                    }}
                  />
                  <Bar dataKey={option1Name} fill="#005ac2" radius={[10, 10, 0, 0]} />
                  <Bar dataKey={option2Name} fill="#4f6073" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low text-center">
                <div>
                  <h4 className="font-headline text-2xl font-bold text-primary">
                    No vote data yet
                  </h4>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    This election has not accumulated trackable vote totals yet.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] bg-primary-container p-6 text-on-primary shadow-ledger-lg">
            <p className="ledger-eyebrow text-on-primary-container">Result summary</p>
            <div className="mt-5 space-y-5 text-sm">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-white">{option1Name}</span>
                  <span className="font-headline text-2xl font-bold text-white">
                    {voteData?.validYesVotes ?? 0}
                  </span>
                </div>
                <p className="mt-1 text-white/70">
                  Preliminary: {voteData?.totalYesVotes ?? 0}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-white">{option2Name}</span>
                  <span className="font-headline text-2xl font-bold text-white">
                    {voteData?.validNoVotes ?? 0}
                  </span>
                </div>
                <p className="mt-1 text-white/70">
                  Preliminary: {voteData?.totalNoVotes ?? 0}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white/10 p-4">
                <p className="ledger-eyebrow text-on-primary-container">
                  Nullification effect
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {stats.nullifiedVotes} tracked ballots were removed from the final outcome.
                </p>
              </div>
            </div>
          </div>

          <div className="ledger-subpanel">
            <p className="ledger-eyebrow">Ledger refresh</p>
            <h3 className="mt-3 font-headline text-2xl font-bold text-primary">
              Last updated
            </h3>
            <p className="mt-3 text-sm text-on-surface-variant">
              {lastUpdated.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {tallyResults.length > 0 && (
        <section className="ledger-subpanel overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-outline-variant/12 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ledger-eyebrow">Processed voter ledger</p>
              <h3 className="mt-2 font-headline text-2xl font-bold text-primary">
                Nullification Resolution
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              Showing the latest processed tally entries.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">
                <tr>
                  <th className="pb-4 pr-6">Voter</th>
                  <th className="pb-4 pr-6">Nullification Count</th>
                  <th className="pb-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/12">
                {tallyResults.slice(0, 12).map((result) => (
                  <tr key={result.userId}>
                    <td className="py-4 pr-6 font-mono text-xs text-on-surface-variant">
                      {result.userId}
                    </td>
                    <td className="py-4 pr-6 font-semibold text-primary">
                      {result.nullificationCount}
                    </td>
                    <td className="py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                          result.voteNullified
                            ? "bg-error-container text-on-error-container"
                            : "bg-secondary-container text-on-secondary-container",
                        ].join(" ")}
                      >
                        {result.voteNullified ? "Nullified" : "Valid"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default TallyResultsDisplay;
