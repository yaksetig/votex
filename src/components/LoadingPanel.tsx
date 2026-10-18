import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingPanelProps {
  /** What is loading, in the user's words: "Loading elections". */
  label: string;
  /** Fill the viewport (route transitions) or just the pane. */
  fullHeight?: boolean;
  className?: string;
}

/**
 * The single loading block for route transitions, protected-route checks
 * and authority panes. It is a live region so assistive tech announces it.
 */
export function LoadingPanel({ label, fullHeight = true, className }: LoadingPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 py-10",
        fullHeight ? "min-h-[calc(100vh-72px)]" : "min-h-[40vh]",
        className
      )}
    >
      <div className="ledger-panel flex items-center gap-3 px-6 py-5" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-secondary" aria-hidden="true" />
        <span className="text-sm font-semibold text-primary">{label}</span>
      </div>
    </div>
  );
}
