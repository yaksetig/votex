import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import VoteReceiptCard from "@/components/VoteReceiptCard";
import { supabase } from "@/integrations/supabase/client";
import type { VoteReceipt } from "@/types/api";

export default function VoteReceiptPage() {
  const { receiptId } = useParams();
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadReceipt = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("public_votes")
        .select("receipt_id, election_id, voter_pseudonym, choice, signature, signed_at, accepted_at")
        .eq("receipt_id", receiptId ?? "")
        .maybeSingle();

      if (cancelled) return;
      if (error || !data?.receipt_id || !data.election_id || !data.voter_pseudonym || !data.choice || !data.signature || !data.signed_at || !data.accepted_at) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: election } = await supabase
        .from("public_elections")
        .select("title")
        .eq("id", data.election_id)
        .maybeSingle();

      const { data: participant } = await supabase
        .from("public_participants")
        .select("public_key_x, public_key_y")
        .eq("election_id", data.election_id)
        .eq("voter_pseudonym", data.voter_pseudonym)
        .maybeSingle();

      const participantPublicKey = participant?.public_key_x && participant.public_key_y
        ? { x: participant.public_key_x, y: participant.public_key_y }
        : null;
      const signatureVerified = participantPublicKey
        ? await import("@/services/signatureService").then(({ verifyVoteSignature }) =>
            verifyVoteSignature(
              data.signature!,
              participantPublicKey,
              data.election_id!,
              data.choice!,
              data.signed_at!
            )
          )
        : false;

      if (!cancelled) {
        setReceipt({
          receiptId: data.receipt_id,
          electionId: data.election_id,
          electionTitle: election?.title ?? "Election",
          voterPseudonym: data.voter_pseudonym,
          choice: data.choice,
          signature: data.signature,
          signedAt: data.signed_at,
          acceptedAt: data.accepted_at,
          signatureVerified,
        });
        setLoading(false);
      }
    };

    void loadReceipt();
    return () => { cancelled = true; };
  }, [receiptId]);

  return (
    <div className="px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-4xl">
        <Link to="/elections" className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to elections
        </Link>
        <section className="ledger-panel mt-6 p-6 sm:p-10">
          <p className="ledger-eyebrow">Public audit ledger</p>
          <h1 className="mt-3 font-headline text-3xl font-extrabold text-primary">Verify ballot receipt</h1>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            This page confirms that a pseudonymous ballot is present in the public Votex ledger. It does not reveal or prove the voter’s real-world identity.
          </p>
          {loading && (
            <div className="mt-8 flex items-center gap-3 text-on-surface-variant" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Checking the ledger…
            </div>
          )}
          {!loading && notFound && (
            <div className="mt-8 rounded-[1.25rem] bg-error-container/60 p-5 text-on-error-container" role="alert">
              No public ballot matches this receipt ID.
            </div>
          )}
          {receipt && <VoteReceiptCard receipt={receipt} />}
        </section>
      </section>
    </div>
  );
}
