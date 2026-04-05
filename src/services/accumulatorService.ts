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
 * If none exists, creates one initialized to [[0]] (identity).
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

  // Initialize with identity ciphertext [[0]]
  const identity = identityCiphertext();
  const newRow = {
    election_id: electionId,
    voter_id: voterId,
    acc_c1_x: identity.c1.x.toString(),
    acc_c1_y: identity.c1.y.toString(),
    acc_c2_x: identity.c2.x.toString(),
    acc_c2_y: identity.c2.y.toString(),
    version: 0,
  };

  const { error: insertError } = await supabase
    .from("nullification_accumulators")
    .insert(newRow);

  if (insertError) {
    // Race condition: another request created it first - re-fetch
    if (insertError.code === "23505") {
      return getOrCreateAccumulator(electionId, voterId);
    }
    logger.error("Error creating accumulator:", insertError);
    throw new Error(`Failed to create accumulator: ${insertError.message}`);
  }

  logger.debug(
    `Created new accumulator for voter ${voterId} in election ${electionId}`
  );
  return { accumulator: identity, version: 0 };
}

/**
 * Update the accumulator with optimistic locking.
 * Returns true on success, false if the version has changed (retry needed).
 */
export async function updateAccumulator(
  electionId: string,
  voterId: string,
  newAccumulator: ElGamalCiphertext,
  expectedVersion: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from("nullification_accumulators")
    .update({
      acc_c1_x: newAccumulator.c1.x.toString(),
      acc_c1_y: newAccumulator.c1.y.toString(),
      acc_c2_x: newAccumulator.c2.x.toString(),
      acc_c2_y: newAccumulator.c2.y.toString(),
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("election_id", electionId)
    .eq("voter_id", voterId)
    .eq("version", expectedVersion)
    .select();

  if (error) {
    logger.error("Error updating accumulator:", error);
    return false;
  }

  if (!data || data.length === 0) {
    logger.warn(
      `Optimistic lock failed for voter ${voterId} (expected version ${expectedVersion})`
    );
    return false;
  }

  logger.debug(
    `Updated accumulator for voter ${voterId} to version ${expectedVersion + 1}`
  );
  return true;
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
