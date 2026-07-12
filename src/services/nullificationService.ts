import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ElGamalCiphertext } from "@/services/elGamalService";
import { Groth16Proof } from "@/types/proof";
import { logger } from "@/services/logger";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";

export interface NullificationProof {
  proof: Groth16Proof;
  publicSignals: string[];
}

export interface Nullification {
  id: string;
  election_id: string;
  user_id: string;
  nullifier_ciphertext: Json;
  nullifier_zkp: NullificationProof | null;
  created_at: string;
}

// Batch store nullifications through the trusted server-side write path.
export async function storeNullificationBatchWithAccumulators(
  electionId: string,
  nullifications: Array<{
    userId: string;
    ciphertext: ElGamalCiphertext;
    newAccumulator: ElGamalCiphertext;
    accumulatorVersion: number;
    zkp: { proof: Groth16Proof; publicSignals: string[] };
  }>
): Promise<boolean> {
  try {
    logger.debug(
      `Submitting batch of ${nullifications.length} XOR nullifications for election ${electionId}`
    );

    const sessionToken = getStoredWorldIdSessionToken();
    if (!sessionToken) {
      logger.error("Cannot submit nullification batch without an active voter session");
      return false;
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
      return false;
    }

    if (data?.error) {
      logger.error("Nullification write was rejected:", data.error);
      return false;
    }

    logger.debug(
      `Successfully stored batch of ${nullifications.length} nullifications via the trusted write path`
    );
    return true;
  } catch (error) {
    logger.error("Error in storeNullificationBatchWithAccumulators:", error);
    return false;
  }
}

// Get nullifications for an election (for election authority use)
export async function getNullificationsForElection(
  electionId: string
): Promise<Nullification[]> {
  try {
    logger.debug(`Fetching nullifications for election: ${electionId}`);

    const rows: Nullification[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("public_nullifications")
        .select("*")
        .eq("election_id", electionId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []).map((nullification) => ({
        ...nullification,
        user_id: nullification.submitter_pseudonym,
      }) as Nullification));
      if (!data || data.length < pageSize) break;
    }

    logger.debug(`Found ${rows.length} nullifications for election`);
    return rows;
  } catch (error) {
    logger.error("Error in getNullificationsForElection:", error);
    return [];
  }
}
