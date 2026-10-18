import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Copy, Fingerprint, Loader2, ShieldCheck, Users, Vote as VoteIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import NullificationDialog from "@/components/NullificationDialog";
import KAnonymityProgressDialog from "@/components/KAnonymityProgressDialog";
import DelegationDialog from "@/components/DelegationDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusPill } from "@/components/StatusPill";
import { BallotOptions } from "@/components/election/BallotOptions";
import { ElectionResults } from "@/components/election/ElectionResults";
import { StoredKeypair } from "@/types/keypair";
import {
  ElectionParticipant,
  getElectionParticipants,
  registerElectionParticipant,
} from "@/services/electionParticipantsService";
import { createDelegation, revokeDelegation, getActiveDelegation } from "@/services/delegationService";
import { getElectionTallyResults, type TallyResult } from "@/services/tallyService";
import { isElectionClosed } from "@/lib/electionStatus";
import { getElectionLifecycle } from "@/lib/electionLifecycle";
import { applyTally, countBallots, describeOutcome, type ElectionOutcome, type PublicBallot } from "@/lib/electionResults";
import { DEFAULT_K } from "@/services/kAnonymityNullificationService";
import { Election } from "@/types/election";
import type { KAnonymityProgress } from "@/services/kAnonymityNullificationService";
import { useDeriveKeypair } from "@/hooks/useDeriveKeypair";
import VoteReceiptCard from "@/components/VoteReceiptCard";
import ElectionPublicAudit from "@/components/ElectionPublicAudit";
import { VotexApiError, type VoteReceipt } from "@/types/api";
import { abbreviateIdentifier, formatDateTime, pluralize } from "@/lib/format";
import { Time } from "@/components/Time";
import { Skeleton } from "@/components/Skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES, howItWorksSection, signInPath } from "@/lib/routes";
import { describeError } from "@/lib/errorMessages";

type LoadState = "loading" | "ready" | "not-found" | "error";

const ElectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId, isWorldIDVerified, markSessionExpired } = useWallet();
  const { deriveKeypair, isDeriving: isDerivingKey } = useDeriveKeypair();

  const [election, setElection] = useState<Election | null>(null);
  usePageTitle(election ? election.title : "Election");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [ballots, setBallots] = useState<PublicBallot[]>([]);
  const [tallyRows, setTallyRows] = useState<TallyResult[]>([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteReceipt, setVoteReceipt] = useState<VoteReceipt | null>(null);
  const [votedChoice, setVotedChoice] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmCast, setConfirmCast] = useState(false);
  const [nullifying, setNullifying] = useState(false);
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null);
  const [needsKeypair, setNeedsKeypair] = useState(false);
  const [participants, setParticipants] = useState<ElectionParticipant[]>([]);
  const [showNullificationDialog, setShowNullificationDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [nullificationProgress, setNullificationProgress] = useState<KAnonymityProgress | null>(null);
  const [hasDelegated, setHasDelegated] = useState(false);
  const [showDelegationDialog, setShowDelegationDialog] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  /** One place for failed actions: expired sessions sign the voter out, everything else becomes a sentence. */
  const reportActionError = useCallback(
    (key: string, title: string, error: unknown, fallback: string) => {
      if (error instanceof VotexApiError && error.code === "SESSION_EXPIRED") {
        markSessionExpired();
        navigate(signInPath(id ? ROUTES.election(id) : ROUTES.elections));
        return;
      }
      toast({ key, variant: "destructive", title, description: describeError(error, fallback) });
    },
    [id, markSessionExpired, navigate, toast]
  );

  const electionClosed = useMemo(() => (election ? isElectionClosed(election) : false), [election]);
  const showRunningTally = election?.show_running_tally !== false;
  const tallied = tallyRows.length > 0;
  const talliedAt = tallyRows.find((row) => row.processedAt)?.processedAt ?? null;

  const outcome: ElectionOutcome | null = useMemo(() => {
    if (!election) return null;
    const options: [string, string] = [election.option1, election.option2];
    if (tallied) return describeOutcome("tallied", applyTally(ballots, tallyRows, ...options));
    return describeOutcome(electionClosed ? "preliminary" : "running", countBallots(ballots, ...options));
  }, [ballots, election, electionClosed, tallied, tallyRows]);

  const rederiveKeypair = async () => {
    const result = await deriveKeypair({ store: true });
    if (result) {
      setKeypair(result.storedKeypair);
      setNeedsKeypair(false);
      setSelectionHint(null);
    }
  };

  const fetchElectionData = useCallback(async () => {
    if (!id) {
      setLoadState("not-found");
      return;
    }
    try {
      setLoadState("loading");

      const { data: electionData, error: electionError } = await supabase
        .from("public_elections")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (electionError) throw electionError;
      if (
        !electionData ||
        !electionData.id ||
        !electionData.title ||
        !electionData.description ||
        !electionData.creator ||
        !electionData.end_date ||
        !electionData.created_at ||
        !electionData.option1 ||
        !electionData.option2
      ) {
        setElection(null);
        setLoadState("not-found");
        return;
      }
      const normalizedElection: Election = {
        ...electionData,
        show_running_tally: electionData.show_running_tally ?? true,
        id: electionData.id,
        title: electionData.title,
        description: electionData.description,
        creator: electionData.creator,
        end_date: electionData.end_date,
        created_at: electionData.created_at,
        option1: electionData.option1,
        option2: electionData.option2,
        last_modified_at: null,
        last_modified_by: null,
      };
      setElection(normalizedElection);

      const closed = isElectionClosed(normalizedElection);
      const [votesResult, participantsList, tally] = await Promise.all([
        supabase.from("public_votes").select("voter_pseudonym, choice").eq("election_id", id),
        getElectionParticipants(id),
        closed ? getElectionTallyResults(id) : Promise.resolve([] as TallyResult[]),
      ]);
      if (votesResult.error) throw votesResult.error;

      setBallots(
        (votesResult.data ?? []).flatMap((row) =>
          row.voter_pseudonym && row.choice ? [{ voterPseudonym: row.voter_pseudonym, choice: row.choice }] : []
        )
      );
      setParticipants(participantsList);
      setTallyRows(tally);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [id]);

  const checkIfUserVoted = useCallback(async () => {
    if (!userId || !id) return;
    try {
      const { data, error } = await supabase
        .from("public_votes")
        .select("receipt_id, choice, signature, signed_at, accepted_at, voter_pseudonym")
        .eq("election_id", id)
        .eq("voter_pseudonym", userId)
        .maybeSingle();
      if (error) throw error;

      const voteExists = !!data;
      let signatureVerified = false;
      if (voteExists && data.signature && data.choice && data.signed_at) {
        const { data: participant } = await supabase
          .from("public_participants")
          .select("public_key_x, public_key_y")
          .eq("election_id", id)
          .eq("voter_pseudonym", userId)
          .maybeSingle();
        if (participant?.public_key_x && participant.public_key_y) {
          const { verifyVoteSignature } = await import("@/services/signatureService");
          signatureVerified = await verifyVoteSignature(
            data.signature,
            { x: participant.public_key_x, y: participant.public_key_y },
            id,
            data.choice,
            data.signed_at
          );
        }
      }
      setHasVoted(voteExists);
      setVoteReceipt(
        voteExists && data.receipt_id && data.choice && data.signature && data.signed_at && data.accepted_at && data.voter_pseudonym
          ? {
              receiptId: data.receipt_id,
              electionId: id,
              electionTitle: election?.title ?? "",
              voterPseudonym: data.voter_pseudonym,
              choice: data.choice,
              signature: data.signature,
              signedAt: data.signed_at,
              acceptedAt: data.accepted_at,
              signatureVerified,
            }
          : null
      );
      setVotedChoice(voteExists ? data.choice : null);
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }, [election?.title, id, userId]);

  const checkDelegationStatus = useCallback(async () => {
    if (!userId || !id) return;
    const delegation = await getActiveDelegation(id, userId);
    setHasDelegated(!!delegation);
  }, [id, userId]);

  useEffect(() => {
    let cancelled = false;
    const loadInitialElectionState = async () => {
      await fetchElectionData();
      try {
        const { validateAndMigrateKeypair } = await import("@/services/keypairService");
        if (cancelled) return;
        const { valid, cleared, keypair: validKeypair } = validateAndMigrateKeypair();
        if (cleared) {
          toast({
            key: "passkey",
            title: "Unlock your passkey again",
            description: "Your voting key was derived with an older setting and has been cleared from this tab.",
          });
          setNeedsKeypair(true);
        } else if (valid && validKeypair) {
          setKeypair(validKeypair);
          setNeedsKeypair(false);
        } else {
          setNeedsKeypair(true);
        }
      } catch {
        if (!cancelled) setNeedsKeypair(true);
      }
    };
    void loadInitialElectionState();
    return () => {
      cancelled = true;
    };
  }, [fetchElectionData, toast]);

  useEffect(() => {
    if (userId && id) {
      void checkIfUserVoted();
      void checkDelegationStatus();
    }
  }, [checkDelegationStatus, checkIfUserVoted, id, userId]);

  const ensureUserIsParticipant = async (): Promise<boolean> => {
    if (!userId || !election || !keypair) return false;
    const participantRegistered = await registerElectionParticipant(election.id, keypair);
    if (participantRegistered) {
      setParticipants(await getElectionParticipants(election.id));
    }
    return participantRegistered;
  };

  const handleDelegate = async (participantIndex: number) => {
    if (!id || !userId || !election || !keypair) return;
    setIsDelegating(true);
    try {
      const { getElectionAuthorityForElection } = await import("@/services/electionAuthorityService");
      const { EdwardsPoint } = await import("@/services/elGamalService");
      const authority = await getElectionAuthorityForElection(id);
      if (!authority) throw new VotexApiError("FIXED_AUTHORITY_UNAVAILABLE", "Election authority unavailable");
      const authorityPk = new EdwardsPoint(BigInt(authority.public_key_x), BigInt(authority.public_key_y));

      await ensureUserIsParticipant();
      await createDelegation(id, participantIndex, authorityPk, keypair);
      setHasDelegated(true);
      setShowDelegationDialog(false);
    } catch (error) {
      reportActionError("delegation", "Ballot not delegated", error, "Your delegation could not be stored. Try again.");
    } finally {
      setIsDelegating(false);
    }
  };

  const handleRevokeDelegation = async () => {
    if (!id || !userId || !keypair) return;
    setIsRevoking(true);
    try {
      await revokeDelegation(id, keypair);
      setHasDelegated(false);
      setConfirmRevoke(false);
    } catch (error) {
      reportActionError("delegation", "Delegation not revoked", error, "The delegation could not be revoked. Try again.");
    } finally {
      setIsRevoking(false);
    }
  };

  const requestCastVote = () => {
    if (needsKeypair || !keypair) {
      setSelectionHint("Unlock your passkey first (see above).");
      return;
    }
    if (!selectedOption) {
      setSelectionHint("Select an option first.");
      return;
    }
    setSelectionHint(null);
    setConfirmCast(true);
  };

  const handleVote = async () => {
    if (!selectedOption || !userId || !election || !keypair || hasVoted || electionClosed) return;
    try {
      setSubmitting(true);
      const participantRegistered = await ensureUserIsParticipant();
      if (!participantRegistered) {
        throw new VotexApiError("PARTICIPANT_REQUIRED", "Participant registration failed");
      }
      const { signVote } = await import("@/services/signatureService");
      const { signature, timestamp } = await signVote(keypair, election.id, selectedOption);
      const { castVote } = await import("@/services/voteTrackingService");
      const receipt = await castVote(election.id, selectedOption, signature, timestamp);
      setVoteReceipt(receipt);
      setVotedChoice(receipt.choice);
      setHasVoted(true);
      setConfirmCast(false);
      await checkIfUserVoted();
      await fetchElectionData();
      toast({
        key: "vote",
        title: "Ballot recorded",
        description: `Your receipt is below. You can nullify this ballot until ${formatDateTime(election.end_date)}.`,
      });
    } catch (error) {
      setConfirmCast(false);
      reportActionError("vote", "Ballot not recorded", error, "Your ballot could not be recorded. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const performNullification = async (isActual: boolean) => {
    if (!userId || !election || !id || !keypair) return;
    if (electionClosed || !hasVoted) return;

    try {
      setNullifying(true);
      setShowNullificationDialog(false);
      setShowProgressDialog(true);

      await ensureUserIsParticipant();

      const [
        { getElectionAuthorityForElection },
        { generateKAnonymousNullifications },
        { storeNullificationBatchWithAccumulators },
        { submitNullificationWithRetry },
      ] = await Promise.all([
        import("@/services/electionAuthorityService"),
        import("@/services/kAnonymityNullificationService"),
        import("@/services/nullificationService"),
        import("@/services/nullificationFlow"),
      ]);

      const authority = await getElectionAuthorityForElection(id);
      if (!authority) {
        throw new VotexApiError("FIXED_AUTHORITY_UNAVAILABLE", "Election authority unavailable");
      }

      const { slotCount } = await submitNullificationWithRetry({
        generate: (onProgress) =>
          generateKAnonymousNullifications(
            id,
            userId,
            keypair,
            { x: authority.public_key_x, y: authority.public_key_y },
            isActual,
            DEFAULT_K,
            onProgress
          ).then((batch) => ({
            slotCount: batch.length,
            items: batch.map((item) => ({
              userId: item.targetUserId,
              ciphertext: item.ciphertext,
              newAccumulator: item.newAccumulator,
              accumulatorVersion: item.accumulatorVersion,
              zkp: item.zkp!,
            })),
          })),
        submit: (batch) => storeNullificationBatchWithAccumulators(id, batch.items),
        onProgress: setNullificationProgress,
      });

      // Deliberately neutral: the UI must not disclose whether the request
      // was a real or a decoy nullification to anyone watching the screen.
      toast({
        key: "nullification",
        title: "Nullification request submitted",
        description:
          slotCount > 1
            ? `Your request is hidden among ${pluralize(slotCount, "participant slot")}.`
            : "No other participants have registered yet, so this request is not hidden among others.",
      });
    } catch (error) {
      reportActionError("nullification", "Nullification request not submitted", error, "The request could not be submitted. Try again.");
    } finally {
      setNullifying(false);
      setShowProgressDialog(false);
      setNullificationProgress(null);
    }
  };

  const copyPseudonym = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      toast({ key: "clipboard", title: "Pseudonym copied" });
    } catch {
      toast({ key: "clipboard", variant: "destructive", title: "Copy failed", description: "Your browser did not allow clipboard access." });
    }
  };

  if (loadState === "loading") {
    return (
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-56" label="Loading election" />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton className="h-[30rem] lg:col-span-7" />
            <Skeleton className="h-[30rem] lg:col-span-5" />
          </div>
        </div>
      </div>
    );
  }

  if (loadState === "not-found" || loadState === "error" || !election || !outcome) {
    const notFound = loadState === "not-found";
    return (
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="ledger-panel p-10 text-center" role={notFound ? undefined : "alert"}>
            <h1 className="font-headline text-3xl font-bold text-primary">
              {notFound ? "Election not found" : "Election could not be loaded"}
            </h1>
            <p className="mt-4 text-on-surface-variant">
              {notFound
                ? "There is no election at this address. It may have been removed, or the link may be wrong."
                : "Check your connection and try again."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {!notFound && (
                <Button onClick={() => void fetchElectionData()}>Retry</Button>
              )}
              <Button variant="outline" asChild>
                <Link to={ROUTES.elections}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to elections
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const options: [string, string] = [election.option1, election.option2];
  const lifecycle = getElectionLifecycle(election, electionClosed ? { tallied } : undefined);

  return (
    <>
      <div className="civic-container pb-12 pt-8">
        <div className="space-y-8">
          <Link
            to={ROUTES.elections}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to elections
          </Link>

          <section className="border-b border-outline-variant pb-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <StatusPill lifecycle={lifecycle} />
              {hasVoted && (
                <span className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold uppercase tracking-[0.05em] text-primary">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  You voted
                </span>
              )}
              {!electionClosed && (
                <span className="text-sm text-on-surface-variant">
                  Closes <Time value={election.end_date} relative />
                </span>
              )}
            </div>
            <h1 className="font-headline text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">{election.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-on-surface-variant">{election.description}</p>
            {hasVoted && votedChoice && (
              <div className="mt-6 inline-flex items-center gap-4 rounded-lg bg-surface-container-low px-5 py-4">
                <div>
                  <p className="ledger-eyebrow">Your ballot</p>
                  <p className="mt-2 font-headline text-xl font-bold text-primary">{votedChoice}</p>
                </div>
              </div>
            )}
            {voteReceipt && <VoteReceiptCard receipt={voteReceipt} />}
          </section>

          <section className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              {isWorldIDVerified && !electionClosed && needsKeypair && (
                <div className="ledger-panel p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-headline text-2xl font-bold text-primary">Unlock your passkey to continue</h2>
                      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                        Your voting key is kept in this tab only, so each new tab or page reload asks for your passkey again.
                        Unlocking derives the key in this browser; it is never sent to Votex.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isDerivingKey) void rederiveKeypair();
                      }}
                      className="ledger-button-primary"
                      aria-busy={isDerivingKey || undefined}
                      aria-disabled={isDerivingKey || undefined}
                    >
                      {isDerivingKey ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Fingerprint className="h-4 w-4" aria-hidden="true" />}
                      {isDerivingKey ? "Waiting for your passkey…" : "Unlock passkey"}
                    </button>
                  </div>
                </div>
              )}

              {statusError && (
                <div className="rounded-xl border border-error/30 bg-error-container p-5 text-on-error-container" role="alert">
                  <h2 className="font-headline text-lg font-bold">We could not check whether you have voted</h2>
                  <p className="mt-2 text-sm">To avoid a duplicate ballot, voting is paused until this check succeeds.</p>
                  <Button variant="outline" className="mt-4" onClick={() => void checkIfUserVoted()}>
                    Retry
                  </Button>
                </div>
              )}

              {electionClosed ? (
                <ElectionResults options={options} outcome={outcome} talliedAt={talliedAt} />
              ) : !hasVoted ? (
                <div className="ledger-panel p-5 sm:p-8">
                  <div className="flex flex-col gap-2">
                    <h2 id="ballot-heading" className="font-headline text-xl font-bold text-primary sm:text-2xl">
                      Cast your ballot
                    </h2>
                    <div className="h-1 w-12 rounded-full bg-surface-tint" aria-hidden="true" />
                  </div>

                  <div className="mt-8">
                    <BallotOptions
                      options={options}
                      value={selectedOption}
                      onChange={(value) => {
                        setSelectedOption(value);
                        setSelectionHint(null);
                      }}
                      disabled={!isWorldIDVerified || statusError}
                      labelledBy="ballot-heading"
                    />
                  </div>

                  {isWorldIDVerified && userId && (
                    <div className="mt-6 rounded-lg bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface-variant">
                      <p>
                        Casting publishes your choice under your pseudonym{" "}
                        <code className="civic-mono text-primary" title={userId}>
                          {abbreviateIdentifier(userId, 6)}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copyPseudonym()}
                          aria-label="Copy pseudonym"
                          className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded align-middle text-on-surface-variant hover:bg-surface-container hover:text-primary"
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        </button>
                        , visible to anyone, permanently. Casting also registers your voting key for this election.{" "}
                        <Link to={ROUTES.privacy} className="font-semibold text-secondary underline-offset-4 hover:underline">
                          Privacy model
                        </Link>
                      </p>
                    </div>
                  )}

                  {hasDelegated ? (
                    <div className="mt-6 rounded-xl border border-outline-variant bg-surface-container-low p-4" role="status">
                      <p className="text-sm text-on-surface-variant">
                        <strong className="text-primary">You have delegated your ballot.</strong> Your ballot will count as your
                        delegate&apos;s choice at the tally. Everyone can see that you delegated; only the Election Authority can
                        see to whom. Revoke to vote yourself instead.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setConfirmRevoke(true)}>
                        Revoke delegation
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-6">
                      {isWorldIDVerified ? (
                        <>
                          <div className="flex flex-wrap gap-4">
                            <Button type="button" onClick={requestCastVote} busy={submitting} aria-disabled={statusError || undefined}>
                              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <VoteIcon className="h-4 w-4" aria-hidden="true" />}
                              {submitting ? "Recording ballot…" : "Cast vote"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                if (needsKeypair || !keypair) {
                                  setSelectionHint("Unlock your passkey first (see above).");
                                  return;
                                }
                                setShowDelegationDialog(true);
                              }}
                            >
                              <Users className="h-4 w-4" aria-hidden="true" />
                              Delegate ballot
                            </Button>
                          </div>
                          <p className="mt-3 min-h-5 text-sm font-medium text-error" role="status" aria-live="polite">
                            {selectionHint ?? ""}
                          </p>
                        </>
                      ) : (
                        <Button asChild>
                          <Link to={signInPath(ROUTES.election(election.id))}>
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                            Sign in to vote
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="ledger-panel p-5 sm:p-6 md:p-8">
                    <div className="flex flex-col gap-2">
                      <h2 className="font-headline text-xl font-bold text-primary sm:text-2xl">Submit a Nullification</h2>
                      <div className="h-1 w-12 rounded-full bg-surface-tint" aria-hidden="true" />
                    </div>
                    <p className="mt-5 leading-relaxed text-on-surface-variant">
                      If you were coerced, use <strong className="text-primary">Actual Nullification</strong> to invalidate your vote. Use{" "}
                      <strong className="text-primary">Dummy Nullification</strong> to simulate the same sequence and preserve plausible deniability.
                    </p>

                    <div className="mt-8">
                      <button
                        type="button"
                        onClick={() => setShowNullificationDialog(true)}
                        className="group flex w-full items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:border-surface-tint/40 sm:gap-5 sm:rounded-xl sm:p-8"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-high transition-colors group-hover:bg-primary sm:h-16 sm:w-16">
                          <ShieldCheck className="h-6 w-6 text-on-surface-variant transition-colors group-hover:text-white sm:h-8 sm:w-8" aria-hidden="true" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-headline text-lg font-bold text-primary sm:text-xl">Nullify Vote</h3>
                          <p className="mt-1 text-sm text-on-surface-variant">Invalidate your ballot or submit a decoy for plausible deniability</p>
                        </div>
                      </button>
                    </div>

                    <div className="mt-8 rounded-lg bg-tertiary-fixed/25 p-4">
                      <p className="text-sm leading-relaxed text-on-surface-variant">
                        <strong className="text-primary">Note:</strong> To external observers, actual and dummy nullifications look exactly the same.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-6 lg:col-span-4">
              {!electionClosed &&
                (showRunningTally ? (
                  <ElectionResults options={options} outcome={outcome} compact />
                ) : (
                  <div className="ledger-panel p-5">
                    <h2 className="font-headline text-lg font-bold text-primary">Results after close</h2>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                      The creator chose to hide the running count. Ballots are still public; the result is shown once the
                      election closes on <Time value={election.end_date} />.
                    </p>
                  </div>
                ))}

              <div className="ledger-panel p-6">
                <h2 className="ledger-eyebrow">This election</h2>
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-surface-container-low p-4">
                    <dt className="ledger-eyebrow">Ballots</dt>
                    <dd className="mt-2 font-headline text-3xl font-extrabold text-primary">{ballots.length}</dd>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-4">
                    <dt className="ledger-eyebrow">Registered participants</dt>
                    <dd className="mt-2 font-headline text-3xl font-extrabold text-primary">{participants.length}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">
                  Participants are voters who have registered a voting key here, whether or not they have voted. Delegated
                  ballots count for the delegate at the tally.
                </p>
              </div>

              <div className="ledger-panel p-6">
                <h2 className="ledger-eyebrow">Privacy model</h2>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  Ballot choices and voter pseudonyms are public so anyone can audit the result. Votex never publishes your
                  real-world identity, but the same pseudonym may be recognisable across elections.{" "}
                  <Link to={howItWorksSection("privacy")} className="font-semibold text-secondary underline-offset-4 hover:underline">
                    Read more
                  </Link>
                </p>
              </div>
            </aside>
          </section>
          <ElectionPublicAudit electionId={election.id} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmCast}
        onOpenChange={(open) => !submitting && setConfirmCast(open)}
        title={`Publish “${selectedOption}”?`}
        description={
          <>
            Your ballot for <strong className="text-primary">{selectedOption}</strong> will be published under your pseudonym{" "}
            {userId ? <code className="civic-mono text-primary">{abbreviateIdentifier(userId, 6)}</code> : null}, visible to
            anyone. This cannot be undone. You can nullify it later, but you cannot cast a different ballot.
          </>
        }
        confirmLabel="Publish ballot"
        busy={submitting}
        onConfirm={handleVote}
      />

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={(open) => !isRevoking && setConfirmRevoke(open)}
        title="Revoke your delegation?"
        description="Your ballot will no longer count for your delegate. You can then vote yourself or delegate to someone else."
        confirmLabel="Revoke delegation"
        destructive
        busy={isRevoking}
        onConfirm={handleRevokeDelegation}
      />

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
