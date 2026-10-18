import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  /** Announced once for the whole placeholder group, e.g. "Loading ballots". */
  label?: string;
}

/**
 * Placeholder block shown while data loads. Pass `label` on the outermost
 * skeleton of a group so assistive tech hears one status message instead of
 * silence; inner blocks stay purely decorative.
 */
export function Skeleton({ className, label }: SkeletonProps) {
  return (
    <div
      className={cn("motion-safe:animate-pulse rounded-xl bg-surface-container", className)}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
