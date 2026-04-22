/**
 * Accumulator Service - XOR accumulator state management
 *
 * Manages per-voter encrypted XOR accumulators. Each voter in an election
 * has one accumulator that starts at [[0]] (identity ciphertext) and gets
 * XOR'd with each nullification.
 *
 * The accumulator is stored in the `nullification_accumulators` table with
 * optimistic locking via a `version` column.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  EdwardsPoint,
  ElGamalCiphertext,
  identityCiphertext,
} from "@/services/elGamalService";
import { logger } from "@/services/logger";

interface StoredAccumulator {
  election_id: string;
  voter_id: string;
  acc_c1_x: string;
  acc_c1_y: string;
  acc_c2_x: string;
  acc_c2_y: string;
  version: number;
}

/** Convert a stored accumulator row to an ElGamalCiphertext */
export function accumulatorToCiphertext(
  acc: StoredAccumulator
): ElGamalCiphertext {
  const c1 = new EdwardsPoint(BigInt(acc.acc_c1_x), BigInt(acc.acc_c1_y));
  const c2 = new EdwardsPoint(BigInt(acc.acc_c2_x), BigInt(acc.acc_c2_y));
  return {
    c1,
    c2,
    r: 0n,
    ciphertext: [c1.x, c1.y, c2.x, c2.y],
  };
}

/**
 * Get the current accumulator for a voter in an election.
 * If none exists yet, treat it as the identity ciphertext locally and let the
 * trusted server-side write path create the row transactionally on submit.
 */
export async function getOrCreateAccumulator(
  electionId: string,
  voterId: string
): Promise<{ accumulator: ElGamalCiphertext; version: number }> {
  // Try to fetch existing accumulator
  const { data, error } = await supabase
    .from("nullification_accumulators")
    .select("*")
    .eq("election_id", electionId)
    .eq("voter_id", voterId)
    .maybeSingle();

  if (error) {
    logger.error("Error fetching accumulator:", error);
    throw new Error(`Failed to fetch accumulator: ${error.message}`);
  }

  if (data) {
    const stored = data as unknown as StoredAccumulator;
    return {
      accumulator: accumulatorToCiphertext(stored),
      version: stored.version,
    };
  }

  return { accumulator: identityCiphertext(), version: 0 };
}

/**
 * Legacy client-side accumulator updates are disabled.
 * Trusted writes now happen only through the nullification edge function.
 */
export async function updateAccumulator(
  electionId: string,
  voterId: string,
  newAccumulator: ElGamalCiphertext,
  expectedVersion: number
): Promise<boolean> {
  void electionId;
  void voterId;
  void newAccumulator;
  void expectedVersion;
  logger.error(
    "Direct client-side accumulator updates are disabled; use the trusted nullification write path"
  );
  return false;
}

/**
 * Get all accumulators for an election (used during tally).
 */
export async function getElectionAccumulators(
  electionId: string
): Promise<StoredAccumulator[]> {
  const { data, error } = await supabase
    .from("nullification_accumulators")
    .select("*")
    .eq("election_id", electionId);

  if (error) {
    logger.error("Error fetching election accumulators:", error);
    return [];
  }

  return (data || []) as unknown as StoredAccumulator[];
}
