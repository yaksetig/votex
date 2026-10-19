import { cn } from "@/lib/utils";
import { LIFECYCLE_LABELS, type ElectionLifecycle } from "@/lib/electionLifecycle";

const TONES: Record<ElectionLifecycle, string> = {
  open: "bg-secondary-container text-on-secondary-container",
  closed: "bg-surface-container text-on-surface-variant",
  closed_early: "bg-surface-container text-on-surface-variant",
  tally_pending: "bg-surface-container text-on-surface-variant",
  tallied: "bg-primary-fixed text-primary",
};

interface StatusPillProps {
  lifecycle: ElectionLifecycle;
  className?: string;
}

/** The one renderer for an election's state; see src/lib/electionLifecycle.ts. */
export function StatusPill({ lifecycle, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-eyebrow",
        TONES[lifecycle],
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 rounded-full", lifecycle === "open" ? "bg-current" : "bg-outline")}
      />
      {LIFECYCLE_LABELS[lifecycle]}
    </span>
  );
}
