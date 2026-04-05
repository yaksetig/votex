import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Plus,
  Vote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getElectionsForAuthority } from "@/services/electionDataService";
import type { AuthorityElection } from "@/services/electionDataService";
import { cn } from "@/lib/utils";

interface AuthorityElectionsListProps {
  authorityId: string;
  authorityName: string;
  onElectionSelect: (electionId: string) => void;
}

const AuthorityElectionsList: React.FC<AuthorityElectionsListProps> = ({
  authorityId,
  authorityName,
  onElectionSelect,
}) => {
  const [elections, setElections] = useState<AuthorityElection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchElections = async () => {
      try {
        setLoading(true);
        setError(null);
        const electionsData = await getElectionsForAuthority(authorityId);
        setElections(electionsData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load elections";
        setError(message);
        toast({
          variant: "destructive",
          title: "Error loading elections",
          description: message,
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchElections();
  }, [authorityId, toast]);

  const stats = useMemo(() => {
    return elections.reduce(
      (accumulator, election) => {
        accumulator.total += 1;
        accumulator.active += election.status === "active" ? 1 : 0;
        accumulator.pendingTally += election.tally_processed ? 0 : 1;
        accumulator.completed += election.tally_processed ? 1 : 0;
        return accumulator;
      },
      { total: 0, active: 0, pendingTally: 0, completed: 0 }
    );
  }, [elections]);

  const getStatusPill = (election: AuthorityElection) => {
    if (election.status === "active") {
      return "bg-surface-tint/10 text-surface-tint";
    }
    if (election.status === "closed_manually") {
      return "bg-error-container text-on-error-container";
    }
    return "bg-surface-container-high text-on-surface-variant";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="ledger-panel h-36 animate-pulse" />
        <div className="ledger-panel h-[34rem] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ledger-panel p-8">
        <div className="flex items-start gap-4 rounded-[1.5rem] bg-error-container/60 p-5 text-on-error-container">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-error" />
          <div>
            <h2 className="font-headline text-xl font-bold text-primary">Election data unavailable</h2>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="ledger-eyebrow">Authority command surface</p>
          <h1 className="mt-3 font-headline text-4xl font-extrabold text-primary">
            Election Authority Admin Panel
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            Secure session active for <span className="font-semibold text-primary">{authorityName}</span>. Review live elections, inspect tally status, and open a management dashboard for any election under your control.
          </p>
        </div>
        <button type="button" className="ledger-button-primary">
          <Plus className="h-4 w-4" />
          Create Election
        </button>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Elections", value: stats.total, icon: Vote, tone: "text-primary border-b-primary" },
          { label: "Active", value: stats.active, icon: CheckCircle2, tone: "text-surface-tint" },
          { label: "Pending Tally", value: stats.pendingTally, icon: Clock3, tone: "text-tertiary-container" },
          { label: "Completed", value: stats.completed, icon: BarChart3, tone: "text-secondary" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={cn("rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-sm", tone.includes("border-b") && "border-b-4")}>
            <div className="mb-5 flex items-center justify-between">
              <Icon className={cn("h-6 w-6", tone.split(" ")[0])} />
            </div>
            <div className={cn("font-headline text-5xl font-extrabold", tone.split(" ")[0])}>{value}</div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] bg-surface-container-low p-1">
        <div className="overflow-hidden rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest">
          <div className="flex flex-col gap-4 border-b border-outline-variant/10 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-headline text-2xl font-bold text-primary">Live Election Ledger</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {elections.length} election{elections.length === 1 ? "" : "s"} under active management
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="ledger-button-secondary px-4 py-2 text-sm">Filter</button>
              <button type="button" className="ledger-button-secondary px-4 py-2 text-sm">Export Log</button>
            </div>
          </div>

          {elections.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-headline text-2xl font-bold text-primary">No elections found</h3>
              <p className="mt-3 text-sm text-on-surface-variant">
                This authority has not published any elections yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-outline-variant/8 bg-surface-container-lowest text-[11px] font-bold uppercase tracking-[0.18em] text-outline">
                  <tr>
                    <th className="px-8 py-4">Election Title</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4">Tally Status</th>
                    <th className="px-6 py-4">Vote Count</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/8">
                  {elections.map((election) => (
                    <tr key={election.id} className="transition-colors hover:bg-surface-container-low">
                      <td className="px-8 py-6">
                        <div>
                          <p className="font-semibold text-on-surface">{election.title}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {election.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className={cn("inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", getStatusPill(election))}>
                          {election.status === "closed_manually"
                            ? "Manually Closed"
                            : election.status === "active"
                              ? "Active"
                              : "Expired"}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className={cn("h-2 w-2 rounded-full", election.tally_processed ? "bg-surface-tint" : "bg-error")} />
                          <span className={election.tally_processed ? "text-surface-tint" : "text-error"}>
                            {election.tally_processed ? "Tallied" : "Pending Tally"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <p className="font-headline text-xl font-extrabold text-primary">{election.vote_count || 0}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          type="button"
                          onClick={() => onElectionSelect(election.id)}
                          className="rounded-xl bg-surface-container-high px-5 py-2 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-white"
                        >
                          Manage Dashboard
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AuthorityElectionsList;
