import { describeError } from "@/lib/errorMessages";
import { abbreviateIdentifier } from "@/lib/format";

/**
 * The tally service throws plain Errors whose messages are written for the
 * log. This maps the ones an operator can act on to sentences and decides
 * whether the typed secret should be kept in the field for another try.
 */
export interface TallyFailure {
  message: string;
  /** True when retrying with a corrected secret could succeed. */
  keepSecret: boolean;
}

export function describeTallyError(error: unknown): TallyFailure {
  const raw = error instanceof Error ? error.message : "";

  if (/recovery key/i.test(raw)) {
    return {
      message: "The authority secret must be the generated recovery key, which starts with votex-auth-v1_. Check the key and try again.",
      keepSecret: true,
    };
  }
  if (/does not match/i.test(raw)) {
    return {
      message: "The authority secret does not match the key registered for this election. Check the key and try again.",
      keepSecret: true,
    };
  }
  const accumulator = raw.match(/Accumulator for (\S+) (contains an invalid point|could not be decoded safely)/);
  if (accumulator) {
    return {
      message: `A nullification record for participant ${abbreviateIdentifier(accumulator[1], 6)} could not be decoded, so the tally cannot be completed. Contact support with this participant id.`,
      keepSecret: false,
    };
  }
  if (/rejected the tally results/i.test(raw)) {
    return {
      message: "The tally was computed but Votex refused to store it. Make sure the election is closed and you are still signed in, then try again.",
      keepSecret: true,
    };
  }
  if (/discrete-log lookup/i.test(raw)) {
    return {
      message: "The tally could not start because a lookup table failed to build. Reload the page and try again.",
      keepSecret: true,
    };
  }
  if (/election authority/i.test(raw)) {
    return {
      message: "The election's authority record could not be loaded. Check your connection and try again.",
      keepSecret: true,
    };
  }
  return { message: describeError(error, "The tally could not be completed. Try again."), keepSecret: true };
}
