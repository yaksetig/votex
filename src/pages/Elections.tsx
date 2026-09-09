import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useWallet } from "@/contexts/WalletContext";
import { getElectionStatus, type ElectionStatus } from "@/lib/electionStatus";
import { useElectionsList } from "@/hooks/queries/useElectionsList";
import ElectionForm from "@/components/ElectionForm";
import type { FormData } from "@/components/ElectionForm/types";
import { createElection } from "@/services/electionCreationService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ElectionFilter = "all" | "active" | "closed";
type ElectionSort = "closing" | "participation";

const PAGE_SIZE = 6;

function statusLabel(status: ElectionStatus) {
  if (status === "closed_manually") return "Closed";
  if (status === "expired") return "Expired";
  return "Active";
}

const Elections = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const { isWorldIDVerified } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    data: elections = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useElectionsList();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ElectionFilter>("all");
  const [sort, setSort] = useState<ElectionSort>("closing");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [filter, sort, searchQuery]);

  useEffect(() => {
    if (!isError) return;
    toast({
      variant: "destructive",
      title: "Failed to load elections",
      description: error instanceof Error ? error.message : "The election browser could not be loaded.",
    });
  }, [isError, error, toast]);

  const handleFormSubmit = async (formData: FormData) => {
    try {
      await createElection(formData);
      toast({ title: "Election published", description: `"${formData.title}" is now live on the ledger.` });
      setShowForm(false);
      setFilter("all");
      setPage(1);
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["elections-list"] }),
      ]);
    } catch (submitError) {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: submitError instanceof Error ? submitError.message : "The election could not be created.",
      });
    }
  };

  const visibleElections = useMemo(() => {
    const matched = elections.filter((election) => {
      const status = getElectionStatus(election);
      const matchesText =
        !searchQuery ||
        election.title.toLowerCase().includes(searchQuery) ||
        election.description?.toLowerCase().includes(searchQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && status === "active") ||
        (filter === "closed" && status !== "active");
      return matchesText && matchesFilter;
    });

    return [...matched].sort((left, right) => {
      if (sort === "participation") return right.voteCount - left.voteCount;
      const leftStatus = getElectionStatus(left);
      const rightStatus = getElectionStatus(right);
      if (leftStatus === "active" && rightStatus !== "active") return -1;
      if (leftStatus !== "active" && rightStatus === "active") return 1;
      return new Date(left.end_date).getTime() - new Date(right.end_date).getTime();
    });
  }, [elections, filter, searchQuery, sort]);

  const activeCount = elections.filter((election) => getElectionStatus(election) === "active").length;
  const totalPages = Math.max(1, Math.ceil(visibleElections.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageElections = visibleElections.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="civic-container space-y-8 pb-28 pt-10 md:pb-12">
        <div className="h-32 animate-pulse rounded-xl bg-surface-container" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-xl bg-surface-container" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="civic-container pb-28 pt-10 md:pb-12">
      {isError && (
        <section className="mb-8 rounded-xl border border-error/30 bg-error-container p-5 text-on-error-container" role="alert">
          <h2 className="font-headline text-xl font-semibold">Election browser unavailable</h2>
          <p className="mt-2 text-sm">The public ledger could not be loaded. Check your connection and retry.</p>
          <button type="button" className="ledger-button-secondary mt-4" onClick={() => void refetch()}>Retry</button>
        </section>
      )}

      <header className="flex flex-col gap-6 border-b border-outline-variant pb-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="civic-label text-secondary">Public election browser</p>
          <h1 className="mt-3 font-headline text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">
            Active Polls &amp; Elections
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">
            Explore binary elections and inspect live public results. Ballot choices and voter pseudonyms are visible for independent auditing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
            <span className="font-bold text-secondary">{activeCount}</span>
            <span className="ml-2 text-on-surface-variant">active now</span>
          </div>
          {isWorldIDVerified ? (
            <button type="button" onClick={() => setShowForm((current) => !current)} className="ledger-button-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {showForm ? "Close Composer" : "Create Election"}
            </button>
          ) : (
            <button type="button" onClick={() => navigate("/dashboard")} className="ledger-button-secondary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Verify to Create
            </button>
          )}
        </div>
      </header>

      {showForm && (
        <section className="ledger-panel mt-8 p-5 sm:p-8">
          <ElectionForm onSubmit={handleFormSubmit} onCancel={() => setShowForm(false)} />
        </section>
      )}

      <section className="mt-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto p-1" aria-label="Election status filter">
            {(["all", "active", "closed"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "min-h-10 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors",
                  filter === value ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:bg-surface-container-low"
                )}
              >
                {value === "all" ? "All Elections" : value === "active" ? "Active" : "Closed & Expired"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-2 pb-2 lg:pb-0">
            <Search className="h-4 w-4 text-outline lg:hidden" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-sm text-on-surface-variant lg:hidden">
              {searchQuery ? `Search: ${searchQuery}` : `${visibleElections.length} elections`}
            </p>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as ElectionSort)}
                className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-semibold text-primary focus:border-secondary focus:ring-secondary"
              >
                <option value="closing">Closing Soon</option>
                <option value="participation">Most Participation</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {pageElections.length === 0 ? (
        <section className="mt-8 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center">
          <Search className="h-10 w-10 text-outline" aria-hidden="true" />
          <h2 className="mt-5 font-headline text-xl font-semibold text-primary">No elections found</h2>
          <p className="mt-2 max-w-md text-sm text-on-surface-variant">Try another search or status filter.</p>
          <button type="button" className="ledger-button-secondary mt-5" onClick={() => setFilter("all")}>Show All Elections</button>
        </section>
      ) : (
        <section className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Elections">
          {pageElections.map((election) => {
            const status = getElectionStatus(election);
            const total = election.option1Count + election.option2Count;
            const option1Percent = total ? Math.round((election.option1Count / total) * 100) : 0;
            const option2Percent = total ? 100 - option1Percent : 0;

            return (
              <article key={election.id} className="civic-card flex min-h-[340px] flex-col overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-ledger">
                <div className="h-1 bg-secondary" />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.05em]",
                      status === "active" ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high text-on-surface-variant"
                    )}>
                      {statusLabel(status)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <Users className="h-4 w-4" aria-hidden="true" /> {election.voteCount.toLocaleString()} votes
                    </span>
                  </div>

                  <h2 className="mt-5 font-headline text-xl font-semibold text-primary">{election.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-on-surface-variant">{election.description}</p>

                  <div className="mt-6 space-y-4">
                    {[
                      { label: election.option1, count: election.option1Count, percent: option1Percent },
                      { label: election.option2, count: election.option2Count, percent: option2Percent },
                    ].map((option, index) => (
                      <div key={option.label}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-semibold text-primary">{index === 0 ? "A" : "B"}. {option.label}</span>
                          <span className="shrink-0 font-bold text-secondary">{total ? `${option.percent}%` : "—"}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                          <div className="h-full rounded-full bg-secondary" style={{ width: `${option.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-outline-variant/50 pt-5">
                    <div>
                      <p className="civic-label">{status === "active" ? "Closes in" : "Closed"}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Clock3 className="h-4 w-4 text-secondary" aria-hidden="true" />
                        {status === "active"
                          ? formatDistanceToNowStrict(new Date(election.end_date))
                          : new Date(election.closed_manually_at ?? election.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/elections/${election.id}`)}
                      className="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-primary"
                    >
                      {status === "active" ? "Vote" : "Results"}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {totalPages > 1 && (
        <nav aria-label="Election pages" className="mt-10 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous page"
            disabled={safePage === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="ledger-button-secondary h-10 min-h-10 px-3"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="text-sm font-semibold text-on-surface-variant">Page {safePage} of {totalPages}</span>
          <button
            type="button"
            aria-label="Next page"
            disabled={safePage === totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="ledger-button-secondary h-10 min-h-10 px-3"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default Elections;
