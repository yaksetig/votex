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
import { parseCanonicalFieldElement } from "@/services/crypto/utils";
import { logger } from "@/services/logger";
import { fetchAllRows } from "@/lib/fetchAllRows";

interface StoredAccumulator {
  election_id: string;
  voter_id: string;
  acc_c1_x: string;
  acc_c1_y: string;
  acc_c2_x: string;
  acc_c2_y: string;
  version: number;
}

/** Parse the four stored coordinates as canonical field elements (throws on aliases). */
export function accumulatorToCiphertext(
  acc: StoredAccumulator
): ElGamalCiphertext {
  const c1 = new EdwardsPoint(
    parseCanonicalFieldElement(acc.acc_c1_x),
    parseCanonicalFieldElement(acc.acc_c1_y)
  );
  const c2 = new EdwardsPoint(
    parseCanonicalFieldElement(acc.acc_c2_x),
    parseCanonicalFieldElement(acc.acc_c2_y)
  );
  return {
    c1,
    c2,
    r: 0n,
    ciphertext: [c1.x, c1.y, c2.x, c2.y],
  };
}

function rowToStoredAccumulator(row: { voter_pseudonym: string | null } & Record<string, unknown>): StoredAccumulator {
  return { ...row, voter_id: row.voter_pseudonym } as unknown as StoredAccumulator;
}

/**
 * Read the current accumulators for a set of voters in one query. Voters with
 * no row yet are reported at the identity ciphertext with version 0; the
 * server-side write path creates their row transactionally on first submit.
 */
export async function readAccumulatorsOrIdentity(
  electionId: string,
  voterIds: string[]
): Promise<Map<string, { accumulator: ElGamalCiphertext; version: number }>> {
  const { data, error } = await supabase
    .from("public_nullification_accumulators")
    .select("*")
    .eq("election_id", electionId)
    .in("voter_pseudonym", voterIds);

  if (error) {
    logger.error("Error fetching accumulators:", error);
    throw new Error(`Failed to fetch accumulators: ${error.message}`);
  }

  const byVoter = new Map<string, { accumulator: ElGamalCiphertext; version: number }>();
  for (const row of data ?? []) {
    const stored = rowToStoredAccumulator(row);
    byVoter.set(stored.voter_id, {
      accumulator: accumulatorToCiphertext(stored),
      version: stored.version,
    });
  }
  for (const voterId of voterIds) {
    if (!byVoter.has(voterId)) {
      byVoter.set(voterId, { accumulator: identityCiphertext(), version: 0 });
    }
  }
  return byVoter;
}

/**
 * Get all accumulators for an election (used during tally).
 */
export async function getElectionAccumulators(
  electionId: string
): Promise<StoredAccumulator[]> {
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("public_nullification_accumulators")
      .select("*")
      .eq("election_id", electionId)
      .order("voter_pseudonym", { ascending: true })
      .range(from, to)
  ).catch((error) => {
    logger.error("Error fetching election accumulators:", error);
    throw new Error("Failed to load election accumulators");
  });
  return rows.map(rowToStoredAccumulator);
}
