import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import VoteReceiptCard, { type ReceiptVerification } from "@/components/VoteReceiptCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { VoteReceipt } from "@/types/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES } from "@/lib/routes";
import { parsePastedReceipt } from "@/lib/receipt";

type LoadState = "loading" | "ready" | "not-found" | "error";

interface VerifiedReceipt {
  receipt: VoteReceipt;
  verification: ReceiptVerification;
}

/** Looks up the participant's key and checks the signature; "unverified" when the key is unavailable. */
async function verifyAgainstRegistry(receipt: Omit<VoteReceipt, "signatureVerified">): Promise<VerifiedReceipt> {
  const { data: participant, error } = await supabase
    .from("public_participants")
    .select("public_key_x, public_key_y")
    .eq("election_id", receipt.electionId)
    .eq("voter_pseudonym", receipt.voterPseudonym)
    .maybeSingle();
  if (error || !participant?.public_key_x || !participant.public_key_y) {
    return { receipt: { ...receipt, signatureVerified: false }, verification: "unverified" };
  }
  const { verifyVoteSignature } = await import("@/services/signatureService");
  const ok = await verifyVoteSignature(
    receipt.signature,
    { x: participant.public_key_x, y: participant.public_key_y },
    receipt.electionId,
    receipt.choice,
    receipt.signedAt
  );
  return { receipt: { ...receipt, signatureVerified: ok }, verification: ok ? "verified" : "invalid" };
}

export default function VoteReceiptPage() {
  usePageTitle("Ballot receipt");
  const { receiptId } = useParams();
  const [state, setState] = useState<LoadState>("loading");
  const [result, setResult] = useState<VerifiedReceipt | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteResult, setPasteResult] = useState<VerifiedReceipt | null>(null);
  const [checkingPaste, setCheckingPaste] = useState(false);

  const loadReceipt = useCallback(async () => {
    if (!receiptId) {
      setState("not-found");
      return;
    }
    setState("loading");
    try {
      const { data, error } = await supabase
        .from("public_votes")
        .select("receipt_id, election_id, voter_pseudonym, choice, signature, signed_at, accepted_at")
        .eq("receipt_id", receiptId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.receipt_id || !data.election_id || !data.voter_pseudonym || !data.choice || !data.signature || !data.signed_at || !data.accepted_at) {
        setState("not-found");
        return;
      }
      const { data: election } = await supabase.from("public_elections").select("title").eq("id", data.election_id).maybeSingle();
      const verified = await verifyAgainstRegistry({
        receiptId: data.receipt_id,
        electionId: data.election_id,
        electionTitle: election?.title ?? "",
        voterPseudonym: data.voter_pseudonym,
        choice: data.choice,
        signature: data.signature,
        signedAt: data.signed_at,
        acceptedAt: data.accepted_at,
      });
      setResult(verified);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [receiptId]);

  useEffect(() => {
    void loadReceipt();
  }, [loadReceipt]);

  const checkPasted = async () => {
    setPasteError(null);
    setPasteResult(null);
    const parsed = parsePastedReceipt(pasted);
    if (!parsed.ok) {
      setPasteError(parsed.error);
      return;
    }
    setCheckingPaste(true);
    try {
      setPasteResult(await verifyAgainstRegistry(parsed.receipt));
    } catch {
      setPasteError("The participant key could not be loaded. Check your connection and try again.");
    } finally {
      setCheckingPaste(false);
    }
  };

  return (
    <div className="civic-container py-10 pb-12">
      <section className="mx-auto max-w-4xl">
        <Link to={ROUTES.elections} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to elections
        </Link>
        <section className="mt-6 border-b border-outline-variant pb-6">
          <p className="ledger-eyebrow text-secondary">Public record</p>
          <h1 className="mt-3 font-headline text-3xl font-bold tracking-display text-primary">Verify ballot receipt</h1>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            This page looks up a ballot in the public record and checks its signature against the voting key registered
            for that pseudonym. It does not reveal or prove anyone&apos;s real-world identity.
          </p>
        </section>

        {state === "loading" && (
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface-variant" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-secondary" aria-hidden="true" />
            Checking the public record…
          </div>
        )}
        {state === "not-found" && (
          <div className="mt-8 rounded-xl border border-outline-variant bg-surface-container-low p-5 text-on-surface-variant" role="status">
            <p className="font-semibold text-primary">No ballot matches this receipt id.</p>
            <p className="mt-1 text-sm">Check the id, or paste the receipt you were given below to verify it directly.</p>
          </div>
        )}
        {state === "error" && (
          <div className="mt-8 rounded-xl border border-error/30 bg-error-container p-5 text-on-error-container" role="alert">
            <p className="font-semibold">The public record could not be reached.</p>
            <Button variant="outline" className="mt-3" onClick={() => void loadReceipt()}>
              Retry
            </Button>
          </div>
        )}
        {state === "ready" && result && <VoteReceiptCard receipt={result.receipt} verification={result.verification} standalone />}

        <section className="mt-12 border-t border-outline-variant pt-8" aria-labelledby="paste-title">
          <h2 id="paste-title" className="font-headline text-2xl font-semibold text-primary">Verify a receipt you were given</h2>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Paste the receipt JSON. The signature is checked against the key registered for its pseudonym in the public
            participants list, independently of the receipt id lookup above.
          </p>
          <div className="mt-4 space-y-3">
            <Label htmlFor="pasted-receipt" className="ledger-eyebrow">
              Receipt JSON
            </Label>
            <Textarea
              id="pasted-receipt"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={6}
              spellCheck={false}
              placeholder='{"receiptId": "…", "electionId": "…", "voterPseudonym": "…", "choice": "…", "signature": "…", "signedAt": 0, "acceptedAt": "…"}'
              className="font-mono text-sm"
              aria-invalid={pasteError ? true : undefined}
              aria-describedby={pasteError ? "pasted-receipt-error" : undefined}
            />
            {pasteError && (
              <p id="pasted-receipt-error" role="alert" className="text-sm font-medium text-error">
                {pasteError}
              </p>
            )}
            <Button type="button" onClick={() => void checkPasted()} busy={checkingPaste} aria-disabled={!pasted.trim() || undefined}>
              {checkingPaste ? "Checking…" : "Check signature"}
            </Button>
          </div>
          {pasteResult && <VoteReceiptCard receipt={pasteResult.receipt} verification={pasteResult.verification} standalone />}
        </section>
      </section>
    </div>
  );
}
