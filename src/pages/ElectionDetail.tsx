import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow, isPast } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Users,
  Vote as VoteIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import NullificationDialog from "@/components/NullificationDialog";
import KAnonymityProgressDialog from "@/components/KAnonymityProgressDialog";
import DelegationDialog from "@/components/DelegationDialog";
import { StoredKeypair } from "@/types/keypair";
import {
  ElectionParticipant,
  getElectionParticipants,
  isUserParticipant,
  registerElectionParticipant,
} from "@/services/electionParticipantsService";
import { createDelegation, revokeDelegation, getActiveDelegation } from "@/services/delegationService";
import { recordVote } from "@/services/voteTrackingService";
import { Election } from "@/types/election";
import type { KAnonymityProgress } from "@/services/kAnonymityNullificationService";

const ElectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId, isWorldIDVerified, setDerivedPublicKey } = useWallet();

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [voteCounts, setVoteCounts] = useState({ option1: 0, option2: 0 });
  const [selectedOption, setSelectedOption] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [voteReceipt, setVoteReceipt] = useState<string | null>(null);
  const [votedChoice, setVotedChoice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nullifying, setNullifying] = useState(false);
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null);
  const [needsKeypair, setNeedsKeypair] = useState(false);
  const [participants, setParticipants] = useState<ElectionParticipant[]>([]);
  const [isParticipant, setIsParticipant] = useState(false);
  const [showNullificationDialog, setShowNullificationDialog] = useState(false);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [nullificationProgress, setNullificationProgress] = useState<KAnonymityProgress | null>(null);
  const [hasDelegated, setHasDelegated] = useState(false);
  const [showDelegationDialog, setShowDelegationDialog] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadInitialElectionState = async () => {
      await fetchElectionData();

      try {
        const [{ initializeDefaultElectionAuthority }, { validateAndMigrateKeypair }] = await Promise.all([
          import("@/services/electionAuthorityService"),
          import("@/services/keypairService"),
        ]);

        await initializeDefaultElectionAuthority();
        if (cancelled) return;

        const { valid, cleared, keypair: validKeypair } = validateAndMigrateKeypair();
        if (cleared) {
          toast({
            variant: "destructive",
            title: "Keypair outdated",
            description: "Your keypair was generated with an older configuration. Derive a fresh one from your passkey.",
          });
          setNeedsKeypair(true);
        } else if (valid && validKeypair) {
          setKeypair(validKeypair);
          setNeedsKeypair(false);
        } else {
          setNeedsKeypair(true);
        }
      } catch {
        if (!cancelled) {
          setNeedsKeypair(true);
        }
      }
    };

    void loadInitialElectionState();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  useEffect(() => {
    if (userId && id) {
      void checkIfUserVoted();
      void checkParticipantStatus();
      void checkDelegationStatus();
    }
  }, [userId, id]);

  const checkDelegationStatus = async () => {
    if (!userId || !id) return;
    const delegation = await getActiveDelegation(id, userId);
    setHasDelegated(!!delegation);
  };

  const handleDelegate = async (participantIndex: number) => {
    if (!id || !userId || !election) return;
    setIsDelegating(true);
    try {
      const { getElectionAuthorityForElection } = await import(
        "@/services/electionAuthorityService"
      );
      const { EdwardsPoint } = await import("@/services/elGamalService");

      const authority = await getElectionAuthorityForElection(id);
      if (!authority) throw new Error("Failed to get election authority");

      const authorityPk = new EdwardsPoint(
        BigInt(authority.public_key_x),
        BigInt(authority.public_key_y)
      );

      const success = await createDelegation(id, userId, participantIndex, authorityPk);
      if (!success) throw new Error("Failed to store delegation");

      setHasDelegated(true);
      setShowDelegationDialog(false);
      toast({
        title: "Vote delegated",
        description: "Your voting power has been privately delegated. The delegate will not know.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delegation failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsDelegating(false);
    }
  };

  const handleRevokeDelegation = async () => {
    if (!id || !userId) return;
    const success = await revokeDelegation(id, userId);
    if (success) {
      setHasDelegated(false);
      toast({
        title: "Delegation revoked",
        description: "You can now vote directly or delegate to someone else.",
      });
    }
  };

  const electionClosed = useMemo(() => {
    if (!election) return false;
    return isPast(new Date(election.end_date)) || !!election.closed_manually_at;
  }, [election]);

  const fetchVoteReceipt = async () => {
    if (!userId || !id) return;

    const { data } = await supabase
      .from("votes")
      .select("id, choice")
      .eq("election_id", id)
      .eq("voter", userId)
      .limit(1)
      .maybeSingle();

    setVoteReceipt(data?.id ?? null);
    setVotedChoice(data?.choice ?? null);
  };

  const checkParticipantStatus = async () => {
    if (!userId || !id) return;

    try {
      const participantStatus = await isUserParticipant(id, userId);
      setIsParticipant(participantStatus);
    } catch {
      setIsParticipant(false);
    }
  };

  const rederiveKeypair = async () => {
    setIsDerivingKey(true);

    try {
      const [
        { authenticateWithPreferredPasskey },
        { deriveKeypairFromSecret, publicKeyToStrings, verifyDerivedKeypair },
        { storeKeypair },
      ] = await Promise.all([
        import("@/services/passkeyService"),
        import("@/services/deterministicKeyService"),
        import("@/services/keypairService"),
      ]);

      const prfResult = await authenticateWithPreferredPasskey();
      const derivedKeypair = await deriveKeypairFromSecret(prfResult.secret);

      if (!verifyDerivedKeypair(derivedKeypair)) {
        throw new Error("Derived keypair verification failed");
      }

      const pkStrings = publicKeyToStrings(derivedKeypair.pk);
      setDerivedPublicKey(pkStrings);

      const storedKeypair = {
        k: derivedKeypair.sk.toString(),
        Ax: derivedKeypair.pk.x.toString(),
        Ay: derivedKeypair.pk.y.toString(),
      };

      storeKeypair(storedKeypair);
      setKeypair(storedKeypair);
      setNeedsKeypair(false);

      toast({
        title: "Passkey unlocked",
        description: "Your signing key has been re-derived locally and is ready for use.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Derivation failed",
        description: error instanceof Error ? error.message : "Failed to derive keypair",
      });
    } finally {
      setIsDerivingKey(false);
    }
  };

  const fetchElectionData = async () => {
    try {
      setLoading(true);

      const { data: electionData, error: electionError } = await supabase
        .from("elections")
        .select("*")
        .eq("id", id)
        .single();

      if (electionError || !electionData) {
        throw electionError ?? new Error("Election not found");
      }

      setElection(electionData);

      const [yesVotesResult, noVotesResult, participantsList] = await Promise.all([
        supabase.from("yes_votes").select("*").eq("election_id", id),
        supabase.from("no_votes").select("*").eq("election_id", id),
        id ? getElectionParticipants(id) : Promise.resolve([]),
      ]);

      if (yesVotesResult.error || noVotesResult.error) {
        const { data: votes, error: votesError } = await supabase
          .from("votes")
          .select("choice")
          .eq("election_id", id);

        if (votesError) throw votesError;

        setVoteCounts({
          option1: votes?.filter((vote) => vote.choice === electionData.option1).length || 0,
          option2: votes?.filter((vote) => vote.choice === electionData.option2).length || 0,
        });
      } else {
        setVoteCounts({
          option1: yesVotesResult.data?.filter((vote) => !vote.nullified).length || 0,
          option2: noVotesResult.data?.filter((vote) => !vote.nullified).length || 0,
        });
      }

      setParticipants(participantsList);
    } catch {
      toast({
        variant: "destructive",
        title: "Election unavailable",
        description: "The requested election could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkIfUserVoted = async () => {
    if (!userId || !id) return;

    try {
      const { data, error } = await supabase
        .from("votes")
        .select("id, choice")
        .eq("election_id", id)
        .eq("voter", userId);

      if (error) throw error;

      const voteExists = !!data && data.length > 0;
      setHasVoted(voteExists);
      setVoteReceipt(voteExists ? data?.[0]?.id ?? null : null);
      setVotedChoice(voteExists ? data?.[0]?.choice ?? null : null);
    } catch {
      setHasVoted(false);
      setVoteReceipt(null);
      setVotedChoice(null);
    }
  };

  const ensureUserIsParticipant = async (): Promise<boolean> => {
    if (!userId || !election || !keypair) return false;

    try {
      if (isParticipant) {
        return true;
      }

      const participantRegistered = await registerElectionParticipant(election.id, userId, keypair);
      if (participantRegistered) {
        setIsParticipant(true);
        const updatedParticipants = await getElectionParticipants(election.id);
        setParticipants(updatedParticipants);
      }

      return participantRegistered;
    } catch {
      return false;
    }
  };

  const handleVote = async () => {
    if (hasVoted) {
      toast({
        variant: "destructive",
        title: "Already voted",
        description: "This identity has already cast a ballot in the current election.",
      });
      return;
    }

    if (electionClosed) {
      toast({
        variant: "destructive",
        title: "Election closed",
        description: "This election is no longer accepting new ballots.",
      });
      return;
    }

    if (!selectedOption || !userId || !election || !keypair) {
      if (!keypair) {
        toast({
          variant: "destructive",
          title: "Passkey required",
          description: "Derive your keypair from your passkey before voting.",
        });
      }
      return;
    }

    try {
      setSubmitting(true);

      const { data: existingVote } = await supabase
        .from("votes")
        .select("id")
        .eq("election_id", election.id)
        .eq("voter", userId)
        .single();

      if (existingVote) {
        setHasVoted(true);
        setVoteReceipt(existingVote.id);
        return;
      }

      const participantRegistered = await ensureUserIsParticipant();
      if (!participantRegistered) {
        throw new Error("Failed to register as election participant");
      }

      const { signVote } = await import("@/services/signatureService");
      const { signature, timestamp } = await signVote(keypair, election.id, selectedOption);

      const { error: voteError } = await supabase.rpc("insert_vote", {
        p_election_id: election.id,
        p_voter: userId,
        p_choice: selectedOption,
        p_nullifier: null,
        p_signature: signature,
        p_timestamp: timestamp,
      });

      if (voteError) throw voteError;

      await recordVote(election.id);
      await checkIfUserVoted();
      await fetchElectionData();

      toast({
        title: "Vote cast successfully",
        description: "Your ballot has been recorded on the ledger.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Vote failed",
        description: "Your ballot could not be submitted. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const performNullification = async (isActual: boolean) => {
    if (!userId || !election || !id || !keypair) return;

    if (electionClosed) {
      toast({
        variant: "destructive",
        title: "Election closed",
        description: "Nullifications are no longer being accepted for this election.",
      });
      return;
    }

    if (!hasVoted) {
      toast({
        variant: "destructive",
        title: "No ballot to nullify",
        description: "You must cast a vote before you can submit a nullification request.",
      });
      return;
    }

    try {
      setNullifying(true);
      setShowNullificationDialog(false);
      setShowProgressDialog(true);

      await ensureUserIsParticipant();

      const [
        { getElectionAuthorityForElection },
        { generateKAnonymousNullifications },
        { storeNullificationBatchWithAccumulators },
      ] = await Promise.all([
        import("@/services/electionAuthorityService"),
        import("@/services/kAnonymityNullificationService"),
        import("@/services/nullificationService"),
      ]);

      const authority = await getElectionAuthorityForElection(id);
      if (!authority) {
        throw new Error("Failed to resolve the election authority");
      }

      const nullificationBatch = await generateKAnonymousNullifications(
        id,
        userId,
        keypair,
        { x: authority.public_key_x, y: authority.public_key_y },
        isActual,
        6,
        (progress) => setNullificationProgress(progress)
      );

      const batchItems = nullificationBatch.map((item) => ({
        userId: item.targetUserId,
        ciphertext: item.ciphertext,
        newAccumulator: item.newAccumulator,
        accumulatorVersion: item.accumulatorVersion,
        zkp: item.zkp!,
      }));

      const stored = await storeNullificationBatchWithAccumulators(id, batchItems);
      if (!stored) {
        throw new Error("Failed to store nullifications");
      }

      toast({
        title: `${isActual ? "Actual" : "Dummy"} nullification submitted`,
        description: `Your request was hidden across ${nullificationBatch.length} participant slots.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Nullification failed",
        description: error instanceof Error ? error.message : "The nullification request could not be submitted.",
      });
    } finally {
      setNullifying(false);
      setShowProgressDialog(false);
      setNullificationProgress(null);
    }
  };

  const totalVotes = voteCounts.option1 + voteCounts.option2;
  const option1Percentage = totalVotes > 0 ? Math.round((voteCounts.option1 / totalVotes) * 100) : 0;
  const option2Percentage = totalVotes > 0 ? Math.round((voteCounts.option2 / totalVotes) * 100) : 0;


  if (loading) {
    return (
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="ledger-panel h-56 animate-pulse" />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="ledger-panel h-[30rem] animate-pulse lg:col-span-7" />
            <div className="ledger-panel h-[30rem] animate-pulse lg:col-span-5" />
          </div>
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="ledger-panel p-10 text-center">
            <h1 className="font-headline text-3xl font-bold text-primary">Election not found</h1>
            <p className="mt-4 text-on-surface-variant">
              The requested ledger entry is unavailable or has been removed.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => navigate("/elections")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Elections
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pb-24 pt-10 sm:px-6 md:pb-10">
        <div className="mx-auto max-w-6xl space-y-10">
          <button
            type="button"
            onClick={() => navigate("/elections")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Elections
          </button>

          <section className="ledger-panel relative overflow-hidden p-8 md:p-12">
            <div className="absolute -right-8 top-0 h-64 w-64 rounded-full bg-primary-fixed-dim/50 blur-[90px]" />
            <div className="relative z-10">
              {hasVoted ? (
                <>
                  <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-surface-tint">
                    <CheckCircle2 className="h-4 w-4" />
                    Vote recorded
                  </div>
                  <h1 className="font-headline text-4xl font-extrabold text-primary md:text-5xl">
                    Vote Cast Successfully.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-on-surface-variant">
                    Your ballot has been recorded. If coercion ever becomes a risk, you can nullify this ballot privately.
                  </p>
                  {votedChoice && (
                    <div className="mt-8 inline-flex items-center gap-4 rounded-[1.25rem] bg-surface-container-low px-5 py-4">
                      <div>
                        <p className="ledger-eyebrow">Your vote</p>
                        <p className="mt-2 font-headline text-xl font-bold text-primary">
                          {votedChoice}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-secondary-container px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-secondary-container">
                      Active ballot
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      Ends {formatDistanceToNow(new Date(election.end_date), { addSuffix: true })}
                    </span>
                  </div>
                  <h1 className="font-headline text-4xl font-extrabold text-primary md:text-5xl">
                    {election.title}
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-on-surface-variant">
                    {election.description}
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="grid gap-10 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-7">
              {needsKeypair && (
                <div className="ledger-panel p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-headline text-2xl font-bold text-primary">Unlock your ballot key</h2>
                      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                        Voting and nullification require the passkey-derived BabyJubJub keypair for this session.
                      </p>
                    </div>
                    <button type="button" onClick={rederiveKeypair} className="ledger-button-primary" disabled={isDerivingKey}>
                      {isDerivingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                      {isDerivingKey ? "Deriving..." : "Unlock Passkey"}
                    </button>
                  </div>
                </div>
              )}

              {electionClosed ? (
                <div className="ledger-panel p-6 md:p-8">
                  <div className="flex flex-col gap-2">
                    <h2 className="font-headline text-2xl font-bold text-primary">Final Results</h2>
                    <div className="h-1 w-12 rounded-full bg-surface-tint" />
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {[election.option1, election.option2].map((option, index) => {
                      const count = index === 0 ? voteCounts.option1 : voteCounts.option2;
                      const percentage = index === 0 ? option1Percentage : option2Percentage;
                      const isWinner = count > (index === 0 ? voteCounts.option2 : voteCounts.option1);
                      return (
                        <div
                          key={option}
                          className={`rounded-[1.5rem] border p-6 ${
                            isWinner
                              ? "border-surface-tint bg-primary-fixed"
                              : "border-outline-variant/15 bg-surface-container-lowest"
                          }`}
                        >
                          <span className="ledger-eyebrow">Option {index === 0 ? "A" : "B"}</span>
                          <h3 className="mt-3 font-headline text-2xl font-bold text-primary">{option}</h3>
                          <div className="mt-6 space-y-2">
                            <div className="flex items-end justify-between">
                              <span className="text-sm text-on-surface-variant">{count} vote{count !== 1 ? "s" : ""}</span>
                              <span className="font-headline text-2xl font-extrabold text-surface-tint">{percentage}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-surface-container-high">
                              <div
                                className="h-full rounded-full bg-surface-tint transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          {isWinner && totalVotes > 0 && (
                            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              Winner
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 text-center text-sm text-on-surface-variant">
                    {totalVotes} total verified vote{totalVotes !== 1 ? "s" : ""} recorded
                  </div>
                </div>
              ) : !hasVoted ? (
                <div className="ledger-panel p-8">
                  <div className="flex flex-col gap-2">
                    <h2 className="font-headline text-2xl font-bold text-primary">Cast your ballot</h2>
                    <div className="h-1 w-12 rounded-full bg-surface-tint" />
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {[election.option1, election.option2].map((option, index) => {
                      const selected = selectedOption === option;
                      const count = index === 0 ? voteCounts.option1 : voteCounts.option2;
                      const percentage = index === 0 ? option1Percentage : option2Percentage;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSelectedOption(option)}
                          className={`rounded-[1.5rem] border p-6 text-left transition-all ${
                            selected
                              ? "border-surface-tint bg-primary-fixed shadow-[0_18px_36px_rgba(0,90,194,0.12)]"
                              : "border-outline-variant/15 bg-surface-container-lowest hover:border-surface-tint/30"
                          }`}
                        >
                          <span className="ledger-eyebrow">Option {index === 0 ? "A" : "B"}</span>
                          <h3 className="mt-3 font-headline text-2xl font-bold text-primary">{option}</h3>
                          <div className="mt-6 space-y-2">
                            <div className="flex items-end justify-between">
                              <span className="text-sm text-on-surface-variant">Current support</span>
                              <span className="font-headline text-2xl font-extrabold text-surface-tint">{percentage}%</span>
                            </div>
                            <div className="h-3 rounded-full bg-surface-container">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-surface-tint"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                              {count} verified vote{count === 1 ? "" : "s"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {hasDelegated ? (
                    <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-blue-800">
                        <strong>You have delegated your vote.</strong> Your voting power has been
                        privately transferred. The delegate will not know.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleRevokeDelegation}
                      >
                        Revoke Delegation
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-wrap gap-4">
                      {isWorldIDVerified ? (
                        <>
                          <button
                            type="button"
                            onClick={handleVote}
                            disabled={submitting || !selectedOption || needsKeypair || electionClosed}
                            className="ledger-button-primary"
                          >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <VoteIcon className="h-4 w-4" />}
                            {submitting ? "Broadcasting..." : "Commit Vote"}
                          </button>
                          <Button
                            variant="outline"
                            onClick={() => setShowDelegationDialog(true)}
                            disabled={needsKeypair || electionClosed}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Delegate Vote
                          </Button>
                        </>
                      ) : (
                        <button type="button" onClick={() => navigate("/dashboard")} className="ledger-button-primary">
                          <ShieldCheck className="h-4 w-4" />
                          Verify Identity First
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="ledger-panel p-6 md:p-8">
                    <div className="flex flex-col gap-2">
                      <h2 className="font-headline text-2xl font-bold text-primary">Submit a Nullification</h2>
                      <div className="h-1 w-12 rounded-full bg-surface-tint" />
                    </div>
                    <p className="mt-5 leading-relaxed text-on-surface-variant">
                      If you were coerced, use <strong className="text-primary">Actual Nullification</strong> to invalidate your vote. Use <strong className="text-primary">Dummy Nullification</strong> to simulate the same sequence and preserve plausible deniability.
                    </p>

                    <div className="mt-8">
                      <button
                        type="button"
                        onClick={() => setShowNullificationDialog(true)}
                        className="group flex w-full items-center gap-5 rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-8 transition-all hover:border-surface-tint/40"
                      >
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-container-high transition-colors group-hover:bg-primary">
                          <ShieldCheck className="h-8 w-8 text-on-surface-variant transition-colors group-hover:text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-headline text-xl font-bold text-primary">Nullify Vote</h3>
                          <p className="mt-1 text-sm text-on-surface-variant">Invalidate your ballot or submit a decoy for plausible deniability</p>
                        </div>
                      </button>
                    </div>

                    <div className="mt-8 rounded-[1.25rem] bg-tertiary-fixed/25 p-4">
                      <p className="text-sm leading-relaxed text-on-surface-variant">
                        <strong className="text-primary">Note:</strong> To external observers, actual and dummy nullifications look exactly the same.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-6 lg:col-span-5">
              <div className="rounded-[2rem] bg-primary-container p-6 text-on-primary shadow-ledger-lg">
                <h3 className="font-headline text-xl font-bold">Security Architecture</h3>
                <ul className="mt-6 space-y-5 text-sm">
                  <li className="flex gap-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-primary-fixed-dim" />
                    <div>
                      <p className="font-semibold text-white">Zero-Knowledge Proofs</p>
                      <p className="mt-1 text-white/72">Prove your right to nullify without revealing identity or vote selection.</p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <Fingerprint className="mt-0.5 h-5 w-5 text-primary-fixed-dim" />
                    <div>
                      <p className="font-semibold text-white">k-Anonymity (k=6)</p>
                      <p className="mt-1 text-white/72">Each nullification is mixed with decoys to obscure timing and intent.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="ledger-panel p-6">
                <p className="ledger-eyebrow">Election telemetry</p>
                <div className="mt-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-on-surface-variant">Total verified votes</span>
                      <span className="font-bold text-primary">{voteCounts.option1 + voteCounts.option2}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-surface-container-high">
                      <div className="h-full w-11/12 rounded-full bg-surface-tint" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-[1.25rem] bg-surface-container-low p-4">
                      <p className="ledger-eyebrow">Participants</p>
                      <p className="mt-2 font-headline text-3xl font-extrabold text-primary">{participants.length}</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-surface-container-low p-4">
                      <p className="ledger-eyebrow">Status</p>
                      <p className="mt-2 font-headline text-2xl font-extrabold text-surface-tint">
                        {electionClosed ? "Closed" : "Live"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>

      <NullificationDialog
        open={showNullificationDialog}
        onOpenChange={setShowNullificationDialog}
        onActualNullification={() => void performNullification(true)}
        onDummyNullification={() => void performNullification(false)}
        isProcessing={nullifying}
      />
      <KAnonymityProgressDialog open={showProgressDialog} progress={nullificationProgress} />
      <DelegationDialog
        open={showDelegationDialog}
        onOpenChange={setShowDelegationDialog}
        participants={participants}
        currentUserId={userId ?? ""}
        onDelegate={handleDelegate}
        isProcessing={isDelegating}
      />
    </>
  );
};

export default ElectionDetail;
