import { CheckCircle2, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      toast({
        title: "Receipt copied",
        description: "The public ballot receipt JSON is on your clipboard.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Your browser did not allow clipboard access. Use Download instead.",
      });
    }
  };

  const downloadReceipt = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `votex-receipt-${receipt.receiptId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-6 rounded-[1.5rem] border border-surface-tint/20 bg-primary-fixed/35 p-5" aria-labelledby="vote-receipt-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-surface-tint">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <h2 id="vote-receipt-title" className="text-sm font-bold uppercase tracking-[0.16em]">
              Public ballot receipt
            </h2>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-on-surface-variant">Receipt ID</dt>
              <dd className="mt-1 break-all font-mono text-xs font-semibold text-primary">{receipt.receiptId}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Accepted</dt>
              <dd className="mt-1 font-semibold text-primary">{new Date(receipt.acceptedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Pseudonymous voter</dt>
              <dd className="mt-1 break-all font-mono text-xs font-semibold text-primary">{receipt.voterPseudonym}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Recorded choice</dt>
              <dd className="mt-1 font-semibold text-primary">{receipt.choice}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Signature</dt>
              <dd className={`mt-1 font-semibold ${receipt.signatureVerified ? "text-surface-tint" : "text-error"}`}>
                {receipt.signatureVerified ? "Verified" : "Not verified"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild type="button" variant="outline" size="sm">
            <Link to={`/receipts/${receipt.receiptId}`}>Verify</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyReceipt()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy JSON
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={downloadReceipt}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download
          </Button>
        </div>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-on-surface-variant">
        This proves that the pseudonymous ballot appears in the public ledger. It is not a privacy-preserving receipt and does not identify a real-world person.
      </p>
    </section>
  );
}
