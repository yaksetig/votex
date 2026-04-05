import React, { useEffect, useState } from "react";
import { isPast } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  ShieldCheck,
  TrendingUp,
  Vote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TallyResultsDisplay from "@/components/TallyResultsDisplay";
import ElectionEditForm from "@/components/ElectionEditForm";
import ElectionAuthorityInterface from "@/components/ElectionAuthorityInterface";
import { closeElectionEarly, isElectionSafeToEdit } from "@/services/electionManagementService";

interface ElectionAuthorityDashboardProps {
  electionId: string;
  authorityName: string;
  onBack: () => void;
}

const ElectionAuthorityDashboard: React.FC<ElectionAuthorityDashboardProps> = ({
  electionId,
  authorityName,
  onBack,
}) => {
  const [election, setElection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [safeToEdit, setSafeToEdit] = useState(false);
  const [tallyProcessed, setTallyProcessed] = useState(false);
  const [tallyStats, setTallyStats] = useState<any>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    void fetchElectionData();
    void checkEditSafety();
    void checkTallyStatus();
  }, [electionId, refreshKey]);

  const fetchElectionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: electionData, error: fetchError } = await supabase
        .from("elections")
        .select("*")
        .eq("id", electionId)
        .single();

      if (fetchError || !electionData) {
        throw fetchError ?? new Error("Election not found");
      }

      let enrichedElection = electionData;
      if (electionData.authority_id) {
        const { data: authorityData } = await supabase
          .from("election_authorities")
          .select("*")
          .eq("id", electionData.authority_id)
          .single();

        if (authorityData) {
          enrichedElection = {
            ...electionData,
            election_authorities: authorityData,
          };
        }
      }

      setElection(enrichedElection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const checkEditSafety = async () => {
    const safe = await isElectionSafeToEdit(electionId);
    setSafeToEdit(safe);
  };

  const checkTallyStatus = async () => {
    try {
      const [totalResult, nullifiedResult, latestResult] = await Promise.all([
        supabase
          .from("election_tallies")
          .select("*", { count: "exact", head: true })
          .eq("election_id", electionId),
        supabase
          .from("election_tallies")
          .select("*", { count: "exact", head: true })
          .eq("election_id", electionId)
          .eq("vote_nullified", true),
        supabase
          .from("election_tallies")
          .select("processed_at, processed_by")
          .eq("election_id", electionId)
          .order("processed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const totalVoters = totalResult.count ?? 0;
      if (totalVoters > 0 && latestResult.data) {
        setTallyProcessed(true);
        setTallyStats({
          totalVoters,
          nullifiedVotes: nullifiedResult.count ?? 0,
          processedAt: latestResult.data.processed_at,
          processedBy: latestResult.data.processed_by,
        });
      } else {
        setTallyProcessed(false);
        setTallyStats(null);
      }
    } catch {
      setTallyProcessed(false);
      setTallyStats(null);
    }
  };

  const handleCloseElection = async () => {
    if (!window.confirm("Close this election early? This action cannot be undone.")) {
      return;
    }

    try {
      setIsClosing(true);
      const success = await closeElectionEarly(electionId);
      if (!success) {
        throw new Error("Failed to close election");
      }

      toast({
        title: "Election closed",
        description: "Voting has been disabled and the election is now ready for tally processing.",
      });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to close election",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsClosing(false);
    }
  };

  const handleElectionUpdated = () => {
    setRefreshKey((value) => value + 1);
  };

  const handleTallyComplete = () => {
    setRefreshKey((value) => value + 1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="ledger-panel h-48 animate-pulse" />
        <div className="ledger-panel h-[42rem] animate-pulse" />
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="ledger-panel p-8">
        <div className="flex items-start gap-4 rounded-[1.5rem] bg-error-container/60 p-5 text-on-error-container">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-error" />
          <div>
            <h2 className="font-headline text-xl font-bold text-primary">Election unavailable</h2>
            <p className="mt-2 text-sm">{error || "Election not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const isManuallyClosed = election.status === "closed_manually" || !!election.closed_manually_at;
  const isNaturallyClosed = !isManuallyClosed && isPast(new Date(election.end_date));
  const isElectionEnded = isManuallyClosed || isNaturallyClosed;
  const canEdit = !isElectionEnded;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Elections List
          </button>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="ledger-badge bg-secondary-container text-on-secondary-container">
              {isElectionEnded ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {isElectionEnded ? "Closed election" : "Secure session active"}
            </span>
            <span className="ledger-badge bg-surface-container-low text-on-surface-variant">
              {authorityName}
            </span>
          </div>

          <h1 className="mt-4 font-headline text-4xl font-extrabold text-primary">
            {election.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
            {election.description}
          </p>
        </div>

        {!isElectionEnded && (
          <button type="button" onClick={handleCloseElection} className="ledger-button-primary" disabled={isClosing}>
            {isClosing ? <TrendingUp className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {isClosing ? "Closing..." : "Close Election Early"}
          </button>
        )}
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-sm">
          <Vote className="h-6 w-6 text-primary" />
          <div className="mt-5 font-headline text-5xl font-extrabold text-primary">2</div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Voting options</p>
        </div>
        <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-sm">
          <CheckCircle2 className="h-6 w-6 text-surface-tint" />
          <div className="mt-5 font-headline text-5xl font-extrabold text-surface-tint">
            {tallyStats?.totalVoters ?? 0}
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Tallied voters</p>
        </div>
        <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-sm">
          <TrendingUp className="h-6 w-6 text-tertiary-container" />
          <div className="mt-5 font-headline text-5xl font-extrabold text-tertiary-container">
            {tallyStats?.nullifiedVotes ?? 0}
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Nullified ballots</p>
        </div>
        <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-secondary" />
          <div className="mt-5 font-headline text-5xl font-extrabold text-secondary">
            {tallyProcessed ? "Done" : isElectionEnded ? "Ready" : "Live"}
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Tally state</p>
        </div>
      </section>

      <section className="rounded-[2rem] bg-surface-container-low p-2">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-2">
            <TabsTrigger value="overview" className="rounded-full px-5 py-3 data-[state=active]:bg-surface-container-lowest data-[state=active]:shadow-sm">
              Overview & Results
            </TabsTrigger>
            <TabsTrigger value="edit" className="rounded-full px-5 py-3 data-[state=active]:bg-surface-container-lowest data-[state=active]:shadow-sm">
              Edit Election
            </TabsTrigger>
            <TabsTrigger value="tally" className="rounded-full px-5 py-3 data-[state=active]:bg-surface-container-lowest data-[state=active]:shadow-sm">
              Process Tally
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="rounded-[1.5rem] bg-surface-container-lowest p-6 shadow-sm">
            <TallyResultsDisplay
              key={refreshKey}
              electionId={election.id}
              electionTitle={election.title}
              option1Name={election.option1}
              option2Name={election.option2}
            />
          </TabsContent>

          <TabsContent value="edit" className="space-y-6 rounded-[1.5rem] bg-surface-container-lowest p-6 shadow-sm">
            {!canEdit && (
              <div className="rounded-[1.25rem] border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                Editing is disabled because this election has already been closed.
              </div>
            )}
            {canEdit && !safeToEdit && (
              <div className="rounded-[1.25rem] border border-error/20 bg-error-container/60 p-4 text-sm text-on-error-container">
                Warning: this election already has votes. Editing option labels may compromise result integrity.
              </div>
            )}
            {canEdit && (
              <ElectionEditForm election={election} safeToEdit={safeToEdit} onElectionUpdated={handleElectionUpdated} />
            )}
          </TabsContent>

          <TabsContent value="tally" className="space-y-6 rounded-[1.5rem] bg-surface-container-lowest p-6 shadow-sm">
            {tallyProcessed && tallyStats ? (
              <div className="rounded-[1.5rem] border border-primary/15 bg-primary-fixed/30 p-6">
                <h3 className="font-headline text-2xl font-bold text-primary">Tally already processed</h3>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  Completed on {new Date(tallyStats.processedAt).toLocaleString()}
                  {tallyStats.processedBy ? ` by ${tallyStats.processedBy}` : ""}.
                </p>
              </div>
            ) : isElectionEnded ? (
              <ElectionAuthorityInterface
                electionId={election.id}
                electionTitle={election.title}
                onTallyComplete={handleTallyComplete}
              />
            ) : (
              <div className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-low p-6">
                <h3 className="font-headline text-2xl font-bold text-primary">Tally processing locked</h3>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  This election is still active. Close it or wait for expiration before decrypting the final nullification accumulators.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

export default ElectionAuthorityDashboard;
