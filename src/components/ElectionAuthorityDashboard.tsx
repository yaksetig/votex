import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusPill } from "@/components/StatusPill";
import { closeElectionEarly, isElectionSafeToEdit } from "@/services/electionOperationsService";
import type { ElectionTallyResult } from "@/services/tallyService";
import type { Election } from "@/types/election";
import { getElectionStatus } from "@/lib/electionStatus";
import { getElectionLifecycle } from "@/lib/electionLifecycle";
import { abbreviateIdentifier, pluralize } from "@/lib/format";
import { Time } from "@/components/Time";
import { Skeleton } from "@/components/Skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { focusById } from "@/lib/focus";

const TallyResultsDisplay = lazy(() => import("@/components/TallyResultsDisplay"));
const ElectionEditForm = lazy(() => import("@/components/ElectionEditForm"));
const ElectionAuthorityInterface = lazy(() => import("@/components/ElectionAuthorityInterface"));

interface ElectionAuthorityDashboardProps {
  electionId: string;
  authorityName: string;
  onBack: () => void;
}

interface TallyStats {
  totalVoters: number;
  nullifiedVotes: number;
  processedAt: string;
  processedBy: string | null;
}

interface Counts {
  ballots: number;
  participants: number;
  delegations: number;
  requests: number;
}

const TabPaneLoading = () => (
  <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-sm text-on-surface-variant" role="status">
    Loading…
  </div>
);

const headCount = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;

const ElectionAuthorityDashboard: React.FC<ElectionAuthorityDashboardProps> = ({ electionId, authorityName, onBack }) => {
  const [election, setElection] = useState<Election | null>(null);
  usePageTitle(election ? `${election.title} · Election Authority` : null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [safeToEdit, setSafeToEdit] = useState(false);
  const [tallyStats, setTallyStats] = useState<TallyStats | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [lastRun, setLastRun] = useState<ElectionTallyResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState("overview");
  const { toast } = useToast();

  const fetchElectionData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const { data: electionData, error: fetchError } = await supabase.from("elections").select("*").eq("id", electionId).maybeSingle();
      if (fetchError) throw fetchError;
      setElection(electionData ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  const checkEditSafety = useCallback(async () => {
    setSafeToEdit(await isElectionSafeToEdit(electionId));
  }, [electionId]);

  const checkTallyStatus = useCallback(async () => {
    try {
      const [totalResult, nullifiedResult, latestResult] = await Promise.all([
        supabase.from("election_tallies").select("*", { count: "exact", head: true }).eq("election_id", electionId),
        supabase.from("election_tallies").select("*", { count: "exact", head: true }).eq("election_id", electionId).eq("vote_nullified", true),
        supabase.from("election_tallies").select("processed_at, processed_by").eq("election_id", electionId).order("processed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const totalVoters = totalResult.count ?? 0;
      if (totalVoters > 0 && latestResult.data) {
        setTallyStats({
          totalVoters,
          nullifiedVotes: nullifiedResult.count ?? 0,
          processedAt: latestResult.data.processed_at,
          processedBy: latestResult.data.processed_by,
        });
      } else {
        setTallyStats(null);
      }
    } catch {
      setTallyStats(null);
    }
  }, [electionId]);

  const fetchCounts = useCallback(async () => {
    try {
      const [ballots, participants, delegations, requests] = await Promise.all([
        headCount(supabase.from("public_votes").select("*", { count: "exact", head: true }).eq("election_id", electionId)),
        headCount(supabase.from("public_participants").select("*", { count: "exact", head: true }).eq("election_id", electionId)),
        headCount(supabase.from("public_delegations").select("*", { count: "exact", head: true }).eq("election_id", electionId).eq("status", "active")),
        headCount(supabase.from("public_nullifications").select("*", { count: "exact", head: true }).eq("election_id", electionId)),
      ]);
      setCounts({ ballots, participants, delegations, requests });
    } catch {
      setCounts(null);
    }
  }, [electionId]);

  useEffect(() => {
    void fetchElectionData();
    void checkEditSafety();
    void checkTallyStatus();
    void fetchCounts();
  }, [checkEditSafety, checkTallyStatus, fetchCounts, fetchElectionData, refreshKey]);

  const handleCloseElection = async () => {
    try {
      setIsClosing(true);
      const success = await closeElectionEarly(electionId);
      if (!success) throw new Error("close failed");
      setConfirmClose(false);
      toast({ key: "election-close", title: "Election closed", description: "Voting and nullification have stopped. The tally can now be run." });
      setRefreshKey((value) => value + 1);
      focusById("authority-election-title");
    } catch {
      toast({
        key: "election-close",
        variant: "destructive",
        title: "Election not closed",
        description: "The election could not be closed. Check your connection and that you are still signed in, then try again.",
      });
    } finally {
      setIsClosing(false);
    }
  };

  const handleTallyComplete = (results: ElectionTallyResult) => {
    setLastRun(results);
    setReplaceMode(false);
    setRefreshKey((value) => value + 1);
  };

  // The result panel mounts after the form; focus it once it exists.
  useEffect(() => {
    if (lastRun) focusById("tally-run-title");
  }, [lastRun]);

  if (loading && !election) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" label="Loading election" />
        <Skeleton className="h-[42rem]" />
      </div>
    );
  }

  if (loadError || !election) {
    return (
      <div className="ledger-panel p-8" role="alert">
        <div className="flex items-start gap-4 rounded-xl bg-error-container p-5 text-on-error-container">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-error" aria-hidden="true" />
          <div>
            <h1 className="font-headline text-xl font-bold">{loadError ? "Election could not be loaded" : "Election not found"}</h1>
            <p className="mt-2 text-sm">{loadError ? "Check your connection and try again." : "There is no election with this id under your authority."}</p>
            <div className="mt-4 flex gap-3">
              {loadError && (
                <Button variant="outline" onClick={() => void fetchElectionData()}>
                  Retry
                </Button>
              )}
              <Button variant="outline" onClick={onBack}>
                Back to elections
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isElectionEnded = getElectionStatus(election) !== "active";
  const tallied = Boolean(tallyStats);
  const canEdit = !isElectionEnded;
  const lifecycle = getElectionLifecycle(election, isElectionEnded ? { tallied } : undefined);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 border-b border-outline-variant pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to elections
          </button>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StatusPill lifecycle={lifecycle} />
            <span className="text-sm text-on-surface-variant">
              {isElectionEnded ? "Closed" : "Closes"} <Time value={election.closed_manually_at ?? election.end_date} relative={!isElectionEnded} />
            </span>
          </div>
          <h1 id="authority-election-title" tabIndex={-1} className="mt-4 font-headline text-3xl font-bold tracking-display text-primary outline-none">{election.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-on-surface-variant">{election.description}</p>
        </div>

        {!isElectionEnded && (
          <Button variant="destructive" onClick={() => setConfirmClose(true)} busy={isClosing}>
            <Lock className="h-4 w-4" aria-hidden="true" />
            Close election early
          </Button>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Ballots", value: counts?.ballots },
          { label: "Registered participants", value: counts?.participants },
          { label: "Active delegations", value: counts?.delegations },
          { label: "Nullification requests", value: counts?.requests, hint: "incl. decoys" },
        ].map(({ label, value, hint }) => (
          <div key={label} className="ledger-panel p-5">
            <dt className="ledger-eyebrow">{label}</dt>
            <dd className="mt-2 font-headline text-3xl font-bold tabular-nums text-primary">
              {value ?? "—"}
              {hint && <span className="mt-1 block font-body text-xs font-normal text-on-surface-variant">{hint}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl bg-surface-container-low p-2">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList aria-label="Election sections" className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-2">
            <TabsTrigger value="overview" className="min-h-11 px-5">
              Overview
            </TabsTrigger>
            <TabsTrigger value="edit" className="min-h-11 px-5">
              Edit
            </TabsTrigger>
            <TabsTrigger value="tally" className="min-h-11 px-5">
              Run tally
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <Suspense fallback={<TabPaneLoading />}>
              <TallyResultsDisplay
                key={refreshKey}
                electionId={election.id}
                electionTitle={election.title}
                option1Name={election.option1}
                option2Name={election.option2}
                electionClosed={isElectionEnded}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="edit" className="space-y-6 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            {!canEdit && (
              <p className="rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant" role="status">
                This election is closed, so its details can no longer be edited.
              </p>
            )}
            {canEdit && !safeToEdit && (
              <p className="rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant" role="status">
                Ballots have been cast, so the question and options are locked. The election can still be closed early.
              </p>
            )}
            {canEdit && safeToEdit && (
              <Suspense fallback={<TabPaneLoading />}>
                <ElectionEditForm election={election} onElectionUpdated={() => setRefreshKey((value) => value + 1)} />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="tally" className="space-y-6 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            {lastRun && (
              <section className="rounded-xl border border-primary/15 bg-primary-fixed/40 p-6" aria-labelledby="tally-run-title" role="status">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h2 id="tally-run-title" tabIndex={-1} className="font-headline text-2xl font-bold text-primary outline-none">
                      Tally run completed
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                      Finished <Time value={lastRun.processedAt} /> by {lastRun.processedBy ?? authorityName}.{" "}
                      {pluralize(lastRun.results.length, "voter record")} resolved;{" "}
                      {pluralize(lastRun.results.filter((r) => r.voteNullified).length, "ballot")} nullified. The result is
                      published on the election page.
                    </p>
                    {lastRun.invalidDelegations.length > 0 && (
                      <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                        <p className="font-semibold text-primary">
                          {pluralize(lastRun.invalidDelegations.length, "delegation")} could not be decoded and{" "}
                          {lastRun.invalidDelegations.length === 1 ? "was" : "were"} ignored
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          The authority key was verified before decryption, so these are malformed records from the delegator.
                          Each delegator kept their own direct ballot.
                        </p>
                        <ul className="mt-2 space-y-1 font-mono text-xs text-on-surface-variant">
                          {lastRun.invalidDelegations.map((item) => (
                            <li key={item.delegationId}>
                              {abbreviateIdentifier(item.delegationId, 6)} · delegator {abbreviateIdentifier(item.delegatorId, 6)} · {item.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {tallied && !replaceMode ? (
              <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
                <h2 className="font-headline text-xl font-bold text-primary">Tally published</h2>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  Run <Time value={tallyStats!.processedAt} />
                  {tallyStats!.processedBy ? ` by ${tallyStats!.processedBy}` : ""}; {pluralize(tallyStats!.totalVoters, "voter record")},{" "}
                  {pluralize(tallyStats!.nullifiedVotes, "ballot")} nullified.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => setConfirmReplace(true)}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Run the tally again
                </Button>
              </div>
            ) : isElectionEnded ? (
              <Suspense fallback={<TabPaneLoading />}>
                <ElectionAuthorityInterface
                  electionId={election.id}
                  electionTitle={election.title}
                  operatorName={authorityName}
                  replaceExisting={replaceMode}
                  onTallyComplete={handleTallyComplete}
                />
              </Suspense>
            ) : (
              <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
                <h2 className="font-headline text-xl font-bold text-primary">Available after the election closes</h2>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  The tally resolves nullifications and delegations, so it can only run once voting has stopped: on{" "}
                  <Time value={election.end_date} />, or earlier if you close the election.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={(open) => !isClosing && setConfirmClose(open)}
        title="Close this election early?"
        description={
          <>
            Voting stops immediately and voters lose the rest of their nullification window, which was due to end on{" "}
            <Time value={election.end_date} />. This cannot be undone. Closing is recorded in the public audit trail.
          </>
        }
        confirmLabel="Close election now"
        destructive
        busy={isClosing}
        onConfirm={handleCloseElection}
      />

      <ConfirmDialog
        open={confirmReplace}
        onOpenChange={setConfirmReplace}
        title="Run the tally again?"
        description="A new run replaces the published result. The previous run is kept in the audit record and the replacement is logged."
        confirmLabel="Start new run"
        onConfirm={() => {
          setConfirmReplace(false);
          setReplaceMode(true);
          setLastRun(null);
        }}
      />
    </div>
  );
};

export default ElectionAuthorityDashboard;
