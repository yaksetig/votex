/**
 * The one place dates, counts and percentages are turned into text.
 *
 * Every timestamp Votex shows is an absolute moment (a deadline, a ballot's
 * acceptance, a tally run), so the default rendering includes the viewer's
 * timezone abbreviation. Relative phrasing ("in 3 days") is a secondary label
 * and always comes from the same date-fns helper so list and detail agree.
 */

import { formatDistanceToNowStrict } from "date-fns";

export type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function isValidDate(value: DateInput): boolean {
  return !Number.isNaN(toDate(value).getTime());
}

/** "17 Oct 2026, 17:58 GMT+1" in the viewer's locale and timezone. */
export function formatDateTime(value: DateInput, options: { withZone?: boolean } = {}): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  const withZone = options.withZone ?? true;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withZone ? { timeZoneName: "short" } : {}),
  }).format(date);
}

/** "17 Oct 2026" without a time, for compact table cells. */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

/** "in 3 days" / "2 hours ago", always from the same helper so pages agree. */
export function formatRelative(value: DateInput): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** The viewer's timezone, e.g. "Europe/Lisbon (GMT+1)", for form hints. */
export function describeLocalTimezone(now: Date = new Date()): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const abbreviation = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")?.value;
  return abbreviation ? `${zone} (${abbreviation})` : zone;
}

/** Formats a Date for a `datetime-local` input in local time (never UTC). */
export function toDateTimeLocalValue(value: DateInput): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "1 vote" / "3 votes" / "0 votes"; pass an irregular plural when needed. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  const label = count === 1 ? singular : plural;
  return `${count.toLocaleString()} ${label}`;
}

/**
 * Splits 100% across two counts so the pair always sums to 100 and a
 * 1-vs-2 split never shows 50/50 (largest-remainder rounding).
 */
export function formatPercentPair(first: number, second: number): [number, number] {
  const total = first + second;
  if (total <= 0) {
    return [0, 0];
  }
  const exactFirst = (first / total) * 100;
  const floorFirst = Math.floor(exactFirst);
  const floorSecond = Math.floor(100 - exactFirst);
  const remainder = 100 - floorFirst - floorSecond;
  const firstGetsRemainder = exactFirst - floorFirst >= 100 - exactFirst - floorSecond;
  return remainder > 0 && firstGetsRemainder
    ? [floorFirst + remainder, floorSecond]
    : [floorFirst, floorSecond + remainder];
}

/** "a1b2c3…x9y8z7" for long pseudonyms and keys; keeps both ends readable. */
export function abbreviateIdentifier(value: string, edge = 6): string {
  if (value.length <= edge * 2 + 1) {
    return value;
  }
  return `${value.slice(0, edge)}…${value.slice(-edge)}`;
}
