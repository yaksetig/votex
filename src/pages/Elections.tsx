import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { formatDistanceToNowStrict, isPast } from "date-fns";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { initializeDefaultElectionAuthority } from "@/services/electionAuthorityService";
import ElectionForm from "@/components/ElectionForm";
import { useToast } from "@/hooks/use-toast";

interface ElectionRecord {
  id: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  end_date: string;
  closed_manually_at?: string | null;
  authority_id?: string | null;
  election_authorities?: { name?: string | null } | null;
  voteCount: number;
}

const Elections = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q")?.toLowerCase() ?? "";
  const { isWorldIDVerified, userId } = useWallet();
  const { toast } = useToast();
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);

      const { data: electionsData, error: electionsError } = await supabase
        .from("elections")
        .select("*")
        .order("created_at", { ascending: false });

      if (electionsError) {
        throw electionsError;
      }

      const authorityIds = [
        ...new Set(
          (electionsData || [])
            .map((election) => election.authority_id)
            .filter(Boolean)
        ),
      ];

      const authoritiesById = new Map<string, { name?: string | null }>();
      if (authorityIds.length > 0) {
        const { data: authoritiesData, error: authoritiesError } = await supabase
          .from("election_authorities")
          .select("id, name")
          .in("id", authorityIds);

        if (authoritiesError) {
          throw authoritiesError;
        }

        (authoritiesData || []).forEach((authority) => {
          authoritiesById.set(authority.id, authority);
        });
      }

      const enriched = await Promise.all(
        (electionsData || []).map(async (election) => {
          const { count } = await supabase
            .from("votes")
            .select("*", { count: "exact", head: true })
            .eq("election_id", election.id);

          return {
            ...election,
            election_authorities: election.authority_id
              ? authoritiesById.get(election.authority_id) || null
              : null,
            voteCount: count ?? 0,
          } as ElectionRecord;
        })
      );

      setElections(enriched);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load elections",
        description:
          error instanceof Error
            ? error.message
            : "The election browser could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeDefaultElectionAuthority();
        await fetchElections();
      } catch {
        await fetchElections();
      }
    };

    void initialize();
  }, [fetchElections]);

  const handleFormSubmit = async (formData: any) => {
    try {
      const { error } = await supabase.from("elections").insert({
        title: formData.title,
        description: formData.description,
        option1: formData.option1,
        option2: formData.option2,
        creator: userId,
        end_date: formData.endDate.toISOString(),
        authority_id: formData.authorityId,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Election published",
        description: `"${formData.title}" is now live on the ledger.`,
      });

      setShowForm(false);
      await fetchElections();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description:
          error instanceof Error
            ? error.message
            : "The election could not be created.",
      });
    }
  };

  const { activeElections, archivedElections, featuredElection } = useMemo(() => {
    const matchesSearch = (election: ElectionRecord) => {
      if (!searchQuery) return true;
      return (
        election.title.toLowerCase().includes(searchQuery) ||
        election.description?.toLowerCase().includes(searchQuery)
      );
    };

    const active = elections.filter(
      (election) =>
        !election.closed_manually_at && !isPast(new Date(election.end_date)) && matchesSearch(election)
    );
    const archived = elections.filter(
      (election) =>
        (!!election.closed_manually_at || isPast(new Date(election.end_date))) && matchesSearch(election)
    );

    return {
      activeElections: active,
      archivedElections: archived,
      featuredElection: active[0] ?? null,
    };
  }, [elections, searchQuery]);

  const secondaryActiveElections = featuredElection
    ? activeElections.filter((election) => election.id !== featuredElection.id)
    : activeElections;

  if (loading) {
    return (
      <div className="px-4 pb-24 pt-10 sm:px-6 md:pb-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="ledger-panel h-56 animate-pulse" />
          <div className="grid gap-6 md:grid-cols-12">
            <div className="ledger-panel h-[28rem] md:col-span-8 animate-pulse" />
            <div className="ledger-panel h-[28rem] md:col-span-4 animate-pulse" />
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="ledger-panel h-72 animate-pulse" />
            <div className="ledger-panel h-72 animate-pulse" />
            <div className="ledger-panel h-72 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-10 sm:px-6 md:pb-10">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-headline text-5xl font-extrabold tracking-tight text-primary md:text-6xl">
              Active Elections
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
              Browse secure, cryptographically verified binary elections. Every ballot contributes to an auditable ledger without exposing the voter behind it.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="ledger-button-secondary">
              <Filter className="h-4 w-4" />
              All Status
            </button>
            {isWorldIDVerified ? (
              <button
                type="button"
                onClick={() => setShowForm((current) => !current)}
                className="ledger-button-primary"
              >
                <Plus className="h-4 w-4" />
                {showForm ? "Close Composer" : "Create Election"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="ledger-button-primary"
              >
                Secure Sign In
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        {showForm && (
          <section className="ledger-panel p-8">
            <ElectionForm
              onSubmit={handleFormSubmit}
              onCancel={() => setShowForm(false)}
            />
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-12">
          <div className="rounded-[2rem] bg-surface-container-low p-8 md:col-span-8">
            {featuredElection ? (
              <div className="relative overflow-hidden rounded-[1.75rem] bg-surface-container-lowest p-8 shadow-ledger">
                <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-surface-tint/10 blur-[120px]" />
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-green-800">
                        Active
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant">
                        <Users className="h-4 w-4" />
                        {featuredElection.voteCount.toLocaleString()} participants
                      </span>
                    </div>

                    <h2 className="mt-6 max-w-2xl font-headline text-4xl font-bold text-primary">
                      {featuredElection.title}
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                      {featuredElection.description}
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low p-6">
                        <span className="ledger-eyebrow">Option A</span>
                        <span className="mt-2 block font-headline text-2xl font-bold text-primary">
                          {featuredElection.option1}
                        </span>
                      </div>
                      <div className="rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low p-6">
                        <span className="ledger-eyebrow">Option B</span>
                        <span className="mt-2 block font-headline text-2xl font-bold text-primary">
                          {featuredElection.option2}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                        Time Remaining
                      </span>
                      <div className="mt-2 font-headline text-3xl font-extrabold text-surface-tint">
                        {formatDistanceToNowStrict(new Date(featuredElection.end_date))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/elections/${featuredElection.id}`)}
                      className="ledger-button-primary"
                    >
                      Join & Vote
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[24rem] items-center justify-center rounded-[1.75rem] bg-surface-container-lowest p-8 text-center shadow-ledger">
                <div>
                  <h2 className="font-headline text-3xl font-bold text-primary">
                    No active elections
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                    Publish a new binary proposal to start collecting verified votes.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6 md:col-span-4">
            <div className="rounded-[2rem] bg-primary-container p-8 text-on-primary shadow-ledger-lg">
              <ShieldCheck className="h-10 w-10 text-primary-fixed-dim" />
              <h3 className="mt-5 font-headline text-2xl font-bold text-white">
                Cryptographic Integrity
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/74">
                Every election uses signed ballots, proof-of-personhood, and tally-side nullification processing to preserve auditability without exposing individual choices.
              </p>
              <button
                type="button"
                onClick={() => navigate("/how-it-works")}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-on-primary-container"
              >
                View Audit Protocol
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="ledger-panel p-6">
              <p className="ledger-eyebrow">Election browser</p>
              <h3 className="mt-3 font-headline text-2xl font-bold text-primary">
                {activeElections.length} live, {archivedElections.length} archived
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                Active ballots appear first. Closed elections remain in the archive for audit review and final result inspection.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-headline text-2xl font-bold text-primary">
              Pending Consensus
            </h2>
            <div className="flex gap-2">
              <button type="button" className="ledger-button-secondary px-3 py-3">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="ledger-button-secondary px-3 py-3">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {secondaryActiveElections.length === 0 ? (
            <div className="ledger-panel p-10 text-center">
              <h3 className="font-headline text-2xl font-bold text-primary">
                No additional live elections
              </h3>
              <p className="mt-3 text-sm text-on-surface-variant">
                The featured ballot above is currently the only active election.
              </p>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {secondaryActiveElections.map((election) => (
                <article
                  key={election.id}
                  className="rounded-[2rem] border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-ledger transition-all hover:-translate-y-1 hover:shadow-ledger-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-green-800">
                      Active
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      {election.voteCount.toLocaleString()} votes
                    </span>
                  </div>

                  <h3 className="mt-6 font-headline text-2xl font-bold text-primary">
                    {election.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">
                    {election.description}
                  </p>

                  <div className="mt-6 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    <span>{election.option1} / {election.option2}</span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-4 w-4" />
                      {formatDistanceToNowStrict(new Date(election.end_date))}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/elections/${election.id}`)}
                    className="mt-6 w-full rounded-[1rem] border border-surface-tint px-4 py-3 text-sm font-bold text-surface-tint transition-all hover:bg-surface-tint hover:text-white"
                  >
                    Join & Vote
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-8 flex items-center gap-4">
            <h2 className="font-headline text-2xl font-bold text-on-surface-variant">
              Past Elections
            </h2>
            <div className="ledger-divider" />
          </div>

          {archivedElections.length === 0 ? (
            <div className="ledger-panel p-10 text-center">
              <h3 className="font-headline text-2xl font-bold text-primary">
                No archived elections yet
              </h3>
              <p className="mt-3 text-sm text-on-surface-variant">
                Closed elections will appear here once voting periods end.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {archivedElections.map((election) => (
                <article
                  key={election.id}
                  className="flex items-center gap-6 rounded-[2rem] border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-ledger"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-surface-container-high text-on-surface-variant">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                        Closed
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        Tallied on {new Date(election.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-headline text-xl font-bold text-primary">
                      {election.title}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Final options: {election.option1} vs {election.option2}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/elections/${election.id}`)}
                    className="text-sm font-bold text-surface-tint"
                  >
                    Results
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Elections;
