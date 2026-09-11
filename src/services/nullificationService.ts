import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ElGamalCiphertext } from "@/services/elGamalService";
import { Groth16Proof } from "@/types/proof";
import { logger } from "@/services/logger";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";
import { readFunctionError } from "@/types/api";
import { normalizeWriteCode, type NullificationWriteResult } from "@/lib/nullificationWriteResult";

interface NullificationProof {
  proof: Groth16Proof;
  publicSignals: string[];
}

export interface Nullification {
  id: string;
  election_id: string;
  /** The participant slot this proof touched; the submitter is never recorded. */
  target_id: string;
  nullifier_ciphertext: Json;
  nullifier_zkp: NullificationProof | null;
  created_at: string;
}

export type { NullificationWriteCode, NullificationWriteResult } from "@/lib/nullificationWriteResult";

/**
 * Submit a k-anonymity batch through nullification-write. The server verifies
 * every proof and applies the batch transactionally; the result code lets the
 * caller distinguish a stale accumulator (retry) from a hard failure.
 */
export async function storeNullificationBatchWithAccumulators(
  electionId: string,
  nullifications: Array<{
    userId: string;
    ciphertext: ElGamalCiphertext;
    newAccumulator: ElGamalCiphertext;
    accumulatorVersion: number;
    zkp: { proof: Groth16Proof; publicSignals: string[] };
  }>
): Promise<NullificationWriteResult> {
  try {
    logger.debug(
      `Submitting batch of ${nullifications.length} XOR nullifications for election ${electionId}`
    );

    const sessionToken = getStoredWorldIdSessionToken();
    if (!sessionToken) {
      logger.error("Cannot submit nullification batch without an active voter session");
      return { ok: false, code: "NO_SESSION", message: "No active voter session" };
    }

    const { data, error } = await supabase.functions.invoke("nullification-write", {
      body: {
        action: "submit-batch",
        electionId,
        sessionToken,
        nullifications: nullifications.map((n) => ({
          accumulatorVersion: n.accumulatorVersion,
          userId: n.userId,
          zkp: n.zkp,
        })),
      },
    });

    if (error) {
      logger.error("Error submitting nullification batch:", error);
      const detail = await readFunctionError(error, "UNKNOWN", "Nullification write failed");
      return {
        ok: false,
        code: normalizeWriteCode(detail.code),
        message: detail.message,
      };
    }

    if (data?.error) {
      logger.error("Nullification write was rejected:", data.error);
      return {
        ok: false,
        code: normalizeWriteCode(data.code),
        message: String(data.error),
      };
    }

    logger.debug(
      `Successfully stored batch of ${nullifications.length} nullifications via the trusted write path`
    );
    return { ok: true };
  } catch (error) {
    logger.error("Error in storeNullificationBatchWithAccumulators:", error);
    return {
      ok: false,
      code: "UNKNOWN",
      message: error instanceof Error ? error.message : "Nullification write failed",
    };
  }
}


/** Every nullification row for an election, newest first (public ledger). */
export async function getNullificationsForElection(
  electionId: string
): Promise<Nullification[]> {
  try {
    logger.debug(`Fetching nullifications for election: ${electionId}`);

    const rows = (await fetchAllRows((from, to) =>
      supabase
        .from("public_nullifications")
        .select("*")
        .eq("election_id", electionId)
        .order("created_at", { ascending: false })
        .range(from, to)
    )).map((nullification) => ({
      ...nullification,
      target_id: nullification.target_pseudonym,
    }) as Nullification);

    logger.debug(`Found ${rows.length} nullifications for election`);
    return rows;
  } catch (error) {
    logger.error("Error in getNullificationsForElection:", error);
    return [];
  }
}
