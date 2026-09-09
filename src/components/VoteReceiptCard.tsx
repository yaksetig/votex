import { CheckCircle2, Code2, Copy, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { VoteReceipt } from "@/types/api";
import { Link } from "react-router-dom";

interface VoteReceiptCardProps {
  receipt: VoteReceipt;
}

export default function VoteReceiptCard({ receipt }: VoteReceiptCardProps) {
  const { toast } = useToast();

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      toast({ title: "Receipt copied", description: "The public ballot receipt JSON is on your clipboard." });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Your browser did not allow clipboard access. Use Download instead." });
    }
  };

  const downloadReceipt = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
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
          <p className="civic-label text-secondary">Receipt verification</p>
          <h2 id="vote-receipt-title" className="mt-1 font-headline text-2xl font-semibold text-primary">Public ballot receipt</h2>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${receipt.signatureVerified ? "bg-green-100 text-green-800" : "bg-error-container text-on-error-container"}`}>
          {receipt.signatureVerified ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          {receipt.signatureVerified ? <><span>Signature</span><span>Verified</span></> : "Signature Not Verified"}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="civic-card p-5 sm:p-7">
            <p className="civic-label">Receipt fingerprint</p>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
              <code className="civic-mono min-w-0 flex-1 break-all text-secondary">{receipt.receiptId}</code>
              <button type="button" aria-label="Copy receipt JSON" onClick={() => void copyReceipt()} className="shrink-0 text-outline hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary">
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm text-on-surface-variant">Election</dt>
                <dd className="mt-1">
                  <Link to={`/elections/${receipt.electionId}`} className="inline-flex items-center gap-1.5 font-semibold text-secondary hover:underline">
                    {receipt.electionTitle} <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-on-surface-variant">Pseudonymous voter</dt>
                <dd className="civic-mono mt-1 break-all text-primary">{receipt.voterPseudonym}</dd>
              </div>
              <div>
                <dt className="text-sm text-on-surface-variant">Recorded choice</dt>
                <dd className="mt-1 flex items-center gap-2 font-semibold text-primary"><span className="h-2 w-2 rounded-full bg-secondary" />{receipt.choice}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 sm:p-7">
            <h3 className="font-headline text-xl font-semibold text-primary">Ledger data</h3>
            <dl className="mt-5 divide-y divide-outline-variant/50 text-sm">
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-on-surface-variant">Signed timestamp</dt>
                <dd className="font-semibold text-primary">{new Date(receipt.signedAt).toLocaleString()}</dd>
              </div>
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-on-surface-variant">Accepted by ledger</dt>
                <dd className="font-semibold text-primary">{new Date(receipt.acceptedAt).toLocaleString()}</dd>
              </div>
              <div className="py-3">
                <dt className="text-on-surface-variant">Serialized signature</dt>
                <dd className="civic-mono mt-2 break-all rounded-lg bg-surface-container-lowest p-3 text-primary">{receipt.signature}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-xl bg-primary p-6 text-on-primary">
            <p className="civic-label text-white/60">Actions</p>
            <div className="mt-4 space-y-3">
              <Link to={`/receipts/${receipt.receiptId}`} className="flex w-full items-center justify-between rounded-lg bg-white/10 p-3 text-sm font-semibold hover:bg-white/20">
                Verify Receipt <ShieldCheck className="h-4 w-4" />
              </Link>
              <button type="button" onClick={() => void copyReceipt()} className="flex w-full items-center justify-between rounded-lg bg-white/10 p-3 text-sm font-semibold hover:bg-white/20">
                Copy Receipt JSON <Code2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={downloadReceipt} className="flex w-full items-center justify-between rounded-lg bg-white/10 p-3 text-sm font-semibold hover:bg-white/20">
                Download JSON <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface p-6">
            <ShieldCheck className="h-6 w-6 text-secondary" aria-hidden="true" />
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              This receipt proves that the pseudonymous ballot appears in the public ledger. It is not privacy-preserving and does not identify a real-world person.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
