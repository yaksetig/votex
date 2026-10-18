import * as z from "zod";

// Shared field-level validation for the election create and edit forms so the
// same entity is validated by the same rules in both places. Limits mirror
// the create-election edge function and the database constraints; messages
// state the limit so the voter knows what to change.
export const ELECTION_LIMITS = {
  title: { min: 3, max: 100 },
  description: { min: 10, max: 500 },
  option: { min: 1, max: 50 },
} as const;

export const electionFieldSchemas = {
  title: z
    .string()
    .trim()
    .min(ELECTION_LIMITS.title.min, `Title needs at least ${ELECTION_LIMITS.title.min} characters`)
    .max(ELECTION_LIMITS.title.max, `Title can be at most ${ELECTION_LIMITS.title.max} characters`),
  description: z
    .string()
    .trim()
    .min(ELECTION_LIMITS.description.min, `Context needs at least ${ELECTION_LIMITS.description.min} characters`)
    .max(ELECTION_LIMITS.description.max, `Context can be at most ${ELECTION_LIMITS.description.max} characters`),
  option1: z
    .string()
    .trim()
    .min(ELECTION_LIMITS.option.min, "Option A is required")
    .max(ELECTION_LIMITS.option.max, `Option A can be at most ${ELECTION_LIMITS.option.max} characters`),
  option2: z
    .string()
    .trim()
    .min(ELECTION_LIMITS.option.min, "Option B is required")
    .max(ELECTION_LIMITS.option.max, `Option B can be at most ${ELECTION_LIMITS.option.max} characters`),
  showRunningTally: z.boolean().default(true),
};

/** The two options must differ once trimmed and lower-cased (the database enforces the same). */
export function optionsAreDistinct(option1: string, option2: string): boolean {
  return option1.trim().toLocaleLowerCase() !== option2.trim().toLocaleLowerCase();
}

export const DISTINCT_OPTIONS_MESSAGE = "Option B must be different from Option A";
