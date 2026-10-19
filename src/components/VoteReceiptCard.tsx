import { CheckCircle2, Code2, Copy, Download, HelpCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import type { VoteReceipt } from "@/types/api";
import { Time } from "@/components/Time";
import { ROUTES, howItWorksSection } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { exportableReceipt } from "@/lib/receipt";

/**
 * verified:   the signature matches the key registered for this pseudonym.
 * unverified: the key could not be loaded yet, so nothing was checked.
 * invalid:    the key is known and the signature does not match it.
 */
export type ReceiptVerification = "verified" | "unverified" | "invalid";

interface VoteReceiptCardProps {
  receipt: VoteReceipt;
  verification?: ReceiptVerification;
  /** True on the receipt page itself, where "Open receipt page" would be circular. */
  standalone?: boolean;
}

const STATES: Record<ReceiptVerification, { label: string; tone: string; icon: typeof ShieldCheck; detail: string }> = {
  verified: {
    label: "Verified",
    tone: "bg-primary-fixed text-primary",
    icon: CheckCircle2,
    detail: "The signature on this ballot matches the voting key registered for this pseudonym in this election.",
  },
  unverified: {
    label: "Could not verify yet",
    tone: "bg-surface-container text-on-surface-variant",
    icon: HelpCircle,
    detail: "The voting key for this pseudonym could not be loaded, so the signature has not been checked. Reload to try again.",
  },
  invalid: {
    label: "Invalid signature",
    tone: "bg-error-container text-on-error-container",
    icon: ShieldAlert,
    detail: "The signature does not match the voting key registered for this pseudonym. This ballot should not be trusted.",
  },
};

export default function VoteReceiptCard({ receipt, verification, standalone = false }: VoteReceiptCardProps) {
  const { toast } = useToast();
  const state = receipt.signatureVerified ? "verified" : (verification ?? "unverified");
  const meta = STATES[state];
  const Icon = meta.icon;
  const exported = JSON.stringify(exportableReceipt(receipt), null, 2);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ key: "clipboard", title: `${label} copied` });
    } catch {
      toast({ key: "clipboard", variant: "destructive", title: "Copy failed", description: "Your browser did not allow clipboard access. Use Download instead." });
    }
  };

  const downloadReceipt = () => {
    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `votex-receipt-${receipt.receiptId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-6" aria-labelledby="vote-receipt-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ledger-eyebrow text-secondary">Receipt</p>
          <h2 id="vote-receipt-title" tabIndex={-1} className="mt-1 font-headline text-2xl font-semibold text-primary outline-none">
            Public ballot receipt
          </h2>
        </div>
        <div className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold", meta.tone)} role="status">
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>Signature</span>
          <span>{meta.label}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="ledger-panel p-5 sm:p-7">
            <p className="text-sm leading-relaxed text-on-surface-variant">{meta.detail}</p>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              A receipt proves that this ballot was accepted into the public record. Whether it counts is decided at the
              tally, and it may change if the voter nullifies.{" "}
              <Link to={howItWorksSection("nullification")} className="font-semibold text-secondary underline-offset-4 hover:underline">
                How nullification works
              </Link>
            </p>

            <p className="ledger-eyebrow mt-6">Receipt id</p>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <code className="civic-mono min-w-0 flex-1 break-all text-secondary">{receipt.receiptId}</code>
              <button
                type="button"
                aria-label="Copy receipt id"
                onClick={() => void copy("Receipt id", receipt.receiptId)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              {receipt.electionTitle && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-on-surface-variant">Election</dt>
                  <dd className="mt-1">
                    <Link to={ROUTES.election(receipt.electionId)} className="font-semibold text-secondary hover:underline">
                      {receipt.electionTitle}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-on-surface-variant">Voter pseudonym</dt>
                <dd className="civic-mono mt-1 break-all text-primary">{receipt.voterPseudonym}</dd>
              </div>
              <div>
                <dt className="text-sm text-on-surface-variant">Choice</dt>
                <dd className="mt-1 flex items-center gap-2 font-semibold text-primary">
                  <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden="true" />
                  {receipt.choice}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-on-surface-variant">Signed</dt>
                <dd className="mt-1 font-semibold text-primary">
                  <Time value={receipt.signedAt} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-on-surface-variant">Accepted</dt>
                <dd className="mt-1 font-semibold text-primary">
                  <Time value={receipt.acceptedAt} />
                </dd>
              </div>
            </dl>
          </div>

          <details className="rounded-xl border border-outline-variant bg-surface-container-low p-5 sm:p-7">
            <summary className="cursor-pointer font-headline text-lg font-semibold text-primary">Technical details</summary>
            <dl className="mt-4 text-sm">
              <dt className="text-on-surface-variant">Signature (EdDSA over the election, choice and signed time)</dt>
              <dd className="civic-mono mt-2 max-h-48 overflow-auto break-all rounded-lg bg-surface-container-lowest p-3 text-primary" tabIndex={0}>
                {receipt.signature}
              </dd>
            </dl>
          </details>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-xl bg-primary p-6 text-on-primary">
            <p className="ledger-eyebrow text-white/70">Keep a copy</p>
            <div className="mt-4 space-y-3">
              {!standalone && (
                <Link
                  to={ROUTES.receipt(receipt.receiptId)}
                  className="flex min-h-11 w-full items-center justify-between rounded-lg bg-white/10 p-3 text-sm font-semibold hover:bg-white/20"
                >
                  Open receipt page <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => void copy("Receipt", exported)}
                className="flex min-h-11 w-full items-center justify-between rounded-lg bg-white/10 p-3 text-sm font-semibold hover:bg-white/20"
              >
                Copy receipt JSON <Code2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={downloadReceipt}
                className="flex min-h-11 w-full items-center justify-between rounded-lg bg-white/10 p-3 text-sm font-semibold hover:bg-white/20"
              >
                Download JSON <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-white/80">
              The file holds the public facts above. Anyone can check the signature against the public key in this
              election&apos;s participants list.
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-6">
            <ShieldCheck className="h-6 w-6 text-secondary" aria-hidden="true" />
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              This receipt is public and shows how this pseudonym voted. It does not identify a real-world person, and
              it is not something to show someone who is pressuring you: use a nullification request instead.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
