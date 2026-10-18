import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { getElectionStatus } from "@/lib/electionStatus";
import { getElectionLifecycle } from "@/lib/electionLifecycle";
import { StatusPill } from "@/components/StatusPill";
import { useElectionsList, type ElectionRecord } from "@/hooks/queries/useElectionsList";
import ElectionForm from "@/components/ElectionForm";
import type { FormData } from "@/components/ElectionForm/types";
import { createElection } from "@/services/electionCreationService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Time } from "@/components/Time";
import { Skeleton } from "@/components/Skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES, signInPath } from "@/lib/routes";
import { describeError } from "@/lib/errorMessages";
import { formatPercentPair, pluralize } from "@/lib/format";

type ElectionFilter = "all" | "active" | "closed";
type ElectionSort = "closing" | "participation";

const PAGE_SIZE = 6;
const FILTERS: Array<{ value: ElectionFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Open" },
  { value: "closed", label: "Closed" },
];

function parseFilter(value: string | null): ElectionFilter {
  return value === "active" || value === "closed" ? value : "all";
}

const Elections = () => {
  usePageTitle("Elections");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const filter = parseFilter(searchParams.get("status"));
  const { isWorldIDVerified } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: elections = [], isLoading, isError, refetch, isFetching } = useElectionsList();
  const [showForm, setShowForm] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [sort, setSort] = useState<ElectionSort>("closing");
  const [page, setPage] = useState(1);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setPage(1), [filter, sort, searchQuery]);

  const setFilter = (next: ElectionFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("status");
    else params.set("status", next);
    setSearchParams(params, { replace: true });
  };

  const closeComposer = () => {
    setShowForm(false);
    setConfirmDiscard(false);
    createButtonRef.current?.focus();
  };

  const requestCloseComposer = () => {
    const dirty = composerRef.current?.querySelector("form")?.hasAttribute("data-dirty");
    if (dirty) setConfirmDiscard(true);
    else closeComposer();
  };

  const handleFormSubmit = async (formData: FormData) => {
    try {
      const { election } = await createElection(formData);
      toast({ key: "election-create", title: "Election published", description: `"${formData.title}" is open for voting.` });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["elections-list"] });
      navigate(ROUTES.election(election.id));
    } catch (submitError) {
      toast({
        key: "election-create",
        variant: "destructive",
        title: "Election not published",
        description: describeError(submitError, "The election could not be created. Try again."),
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
  const hasFilters = filter !== "all" || searchQuery.length > 0;

  const goToPage = (next: number) => {
    setPage(Math.min(totalPages, Math.max(1, next)));
    listHeadingRef.current?.scrollIntoView({ block: "start" });
    listHeadingRef.current?.focus();
  };

  if (isLoading) {
    return (
      <div className="civic-container space-y-8 pb-12 pt-10">
        <Skeleton className="h-32" label="Loading elections" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="civic-container pb-12 pt-10">
      <header className="flex flex-col gap-6 border-b border-outline-variant pb-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="ledger-eyebrow text-secondary">Elections</p>
          <h1 className="mt-3 font-headline text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">Elections</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">
            Every ballot is public under the voter&apos;s pseudonym, so anyone can check the result. Sign in with World
            ID to vote or to create an election.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
            <span className="font-bold text-secondary">{activeCount}</span>
            <span className="ml-2 text-on-surface-variant">open now</span>
          </p>
          {isWorldIDVerified ? (
            <button
              ref={createButtonRef}
              type="button"
              aria-expanded={showForm}
              aria-controls="election-composer"
              onClick={() => (showForm ? requestCloseComposer() : setShowForm(true))}
              className={showForm ? "ledger-button-secondary" : "ledger-button-primary"}
            >
              {showForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              {showForm ? "Close composer" : "Create Election"}
            </button>
          ) : (
            <Link to={signInPath(ROUTES.elections)} className="ledger-button-secondary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Sign in to create
            </Link>
          )}
        </div>
      </header>

      {showForm && (
        <section id="election-composer" ref={composerRef} className="ledger-panel mt-8 p-5 sm:p-8">
          <ElectionForm onSubmit={handleFormSubmit} onCancel={requestCloseComposer} />
        </section>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this election?"
        description="What you have typed so far will be lost."
        confirmLabel="Discard"
        destructive
        onConfirm={closeComposer}
      />

      {isError ? (
        <section className="mt-8 rounded-xl border border-error/30 bg-error-container p-6 text-on-error-container" role="alert">
          <h2 className="font-headline text-xl font-semibold">Elections could not be loaded</h2>
          <p className="mt-2 text-sm">Check your connection and try again.</p>
          <button type="button" className="ledger-button-secondary mt-4" onClick={() => void refetch()} aria-busy={isFetching || undefined}>
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-sm" aria-label="Filter and sort">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 overflow-x-auto p-1" role="group" aria-label="Status">
                {FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors",
                      filter === value ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:bg-surface-container-low"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3 px-2 pb-2 sm:flex-row sm:items-center lg:pb-0">
                <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg bg-surface-container-low px-3 lg:hidden">
                  <Search className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
                  <span className="sr-only">Search elections</span>
                  <input
                    type="search"
                    value={searchParams.get("q") ?? ""}
                    onChange={(event) => {
                      const params = new URLSearchParams(searchParams);
                      if (event.target.value) params.set("q", event.target.value);
                      else params.delete("q");
                      setSearchParams(params, { replace: true });
                    }}
                    placeholder="Search elections"
                    className="w-full bg-transparent text-base text-primary outline-none placeholder:text-on-surface-variant"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <span className="sr-only sm:not-sr-only">Sort</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as ElectionSort)}
                    className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3 text-base font-semibold text-primary focus:border-secondary focus:ring-secondary md:text-sm"
                  >
                    <option value="closing">Closing soonest</option>
                    <option value="participation">Most ballots</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <h2 ref={listHeadingRef} tabIndex={-1} className="sr-only">
            {pluralize(visibleElections.length, "election")}
          </h2>
          <p className="mt-4 text-sm text-on-surface-variant" aria-live="polite">
            {pluralize(visibleElections.length, "election")}
            {hasFilters ? " match" : ""}
            {searchQuery ? ` “${searchParams.get("q")}”` : ""}
          </p>

          {pageElections.length === 0 ? (
            elections.length === 0 ? (
              <section className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center">
                <Users className="h-10 w-10 text-on-surface-variant" aria-hidden="true" />
                <h3 className="mt-5 font-headline text-xl font-semibold text-primary">No elections yet</h3>
                <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                  {isWorldIDVerified ? "Create the first one with the button above." : "Sign in with World ID to create the first one."}
                </p>
              </section>
            ) : (
              <section className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center">
                <Search className="h-10 w-10 text-on-surface-variant" aria-hidden="true" />
                <h3 className="mt-5 font-headline text-xl font-semibold text-primary">No matches</h3>
                <p className="mt-2 max-w-md text-sm text-on-surface-variant">Try another word or a different status.</p>
                <button
                  type="button"
                  className="ledger-button-secondary mt-5"
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  Clear filters
                </button>
              </section>
            )
          ) : (
            <section className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Elections">
              {pageElections.map((election) => (
                <ElectionCard key={election.id} election={election} />
              ))}
            </section>
          )}

          {totalPages > 1 && (
            <nav aria-label="Election pages" className="mt-10 flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Previous page"
                aria-disabled={safePage === 1 || undefined}
                onClick={() => safePage > 1 && goToPage(safePage - 1)}
                className={cn("ledger-button-secondary h-11 min-h-11 px-3", safePage === 1 && "opacity-50")}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold text-on-surface-variant" aria-live="polite">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                aria-disabled={safePage === totalPages || undefined}
                onClick={() => safePage < totalPages && goToPage(safePage + 1)}
                className={cn("ledger-button-secondary h-11 min-h-11 px-3", safePage === totalPages && "opacity-50")}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
};

function ElectionCard({ election }: { election: ElectionRecord }) {
  const status = getElectionStatus(election);
  const open = status === "active";
  const showsRunningTally = election.show_running_tally !== false;
  const showCounts = showsRunningTally || !open;
  const [percentA, percentB] = formatPercentPair(election.option1Count, election.option2Count);
  const total = election.option1Count + election.option2Count;

  return (
    <article className="ledger-panel relative flex min-h-[340px] flex-col overflow-hidden transition-shadow focus-within:shadow-ledger hover:shadow-ledger">
      <div className={cn("h-1", open ? "bg-secondary" : "bg-outline-variant")} aria-hidden="true" />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <StatusPill lifecycle={getElectionLifecycle(election)} />
          <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
            <Users className="h-4 w-4" aria-hidden="true" />
            {showCounts ? pluralize(election.voteCount, "ballot") : "Results after close"}
          </span>
        </div>

        <h3 className="mt-5 font-headline text-xl font-semibold text-primary">
          {/* Stretched link: the whole card is the target; the CTA below is a second, visible one. */}
          <Link to={ROUTES.election(election.id)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {election.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-on-surface-variant">{election.description}</p>

        <div className="mt-6 space-y-4">
          {[
            { label: election.option1, percent: percentA },
            { label: election.option2, percent: percentB },
          ].map((option, index) => (
            <div key={`${index}-${option.label}`}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold text-primary">
                  {index === 0 ? "A" : "B"}. {option.label}
                </span>
                <span className="shrink-0 font-bold text-secondary">
                  {showCounts && total ? `${option.percent}%` : "—"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                <div className="h-full rounded-full bg-secondary" style={{ width: showCounts ? `${option.percent}%` : "0%" }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-outline-variant pt-5">
          <div>
            <p className="ledger-eyebrow">{open ? "Closes" : "Closed"}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Clock3 className="h-4 w-4 text-secondary" aria-hidden="true" />
              {open ? <Time value={election.end_date} relative /> : <Time value={election.closed_manually_at ?? election.end_date} />}
            </p>
          </div>
          <Link
            to={ROUTES.election(election.id)}
            className="relative z-10 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-secondary hover:bg-surface-container-low hover:text-primary"
            aria-label={`${open ? "Vote" : "Results"}: ${election.title}`}
          >
            {open ? "Vote" : "Results"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default Elections;
