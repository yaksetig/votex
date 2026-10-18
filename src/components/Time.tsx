import { formatDateTime, formatRelative, isValidDate, type DateInput } from "@/lib/format";

interface TimeProps {
  value: DateInput;
  /** Append "(in 3 days)" after the absolute time. */
  relative?: boolean;
  className?: string;
}

/**
 * Absolute timestamp with timezone in a semantic <time> element, optionally
 * followed by the relative distance. Use this instead of toLocaleString().
 */
export function Time({ value, relative = false, className }: TimeProps) {
  if (!isValidDate(value)) {
    return <span className={className}>Unknown date</span>;
  }
  const iso = new Date(value).toISOString();
  return (
    <time dateTime={iso} className={className}>
      {formatDateTime(value)}
      {relative ? ` (${formatRelative(value)})` : null}
    </time>
  );
}
