import { supabase } from "@/integrations/supabase/client";
import { ElGamalCiphertext } from "@/services/elGamalService";
import { Groth16Proof } from "@/types/proof";
import { Json } from "@/integrations/supabase/types";
import { updateAccumulator } from "@/services/accumulatorService";
import { verifyNullificationProof } from "@/services/zkProofService";
import { logger } from "@/services/logger";

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

// Store a single nullification in the database
export async function storeNullification(
  electionId: string,
  userId: string,
  ciphertext: ElGamalCiphertext,
  zkp?: NullificationProof
): Promise<boolean> {
  try {
    logger.debug(
      `Storing nullification for user ${userId} in election ${electionId}`
    );

    const nullifierData = {
      c1: {
        x: ciphertext.c1.x.toString(),
        y: ciphertext.c1.y.toString(),
      },
      c2: {
        x: ciphertext.c2.x.toString(),
        y: ciphertext.c2.y.toString(),
      },
    };

    const { error } = await supabase.from("nullifications").insert({
      election_id: electionId,
      user_id: userId,
      nullifier_ciphertext: nullifierData,
      nullifier_zkp: (zkp as unknown as Json) || null,
    });

    if (error) {
      logger.error("Error storing nullification:", error);
      return false;
    }

    logger.debug("Successfully stored nullification");
    return true;
  } catch (error) {
    logger.error("Error in storeNullification:", error);
    return false;
  }
}

// Batch store nullifications AND update accumulators atomically
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
      `Storing batch of ${nullifications.length} XOR nullifications for election ${electionId}`
    );

    // Verify all proofs in parallel before persisting anything
    logger.debug(
      `Verifying ${nullifications.length} proofs in parallel...`
    );
    const verificationResults = await Promise.all(
      nullifications.map(async (n) => {
        const valid = await verifyNullificationProof(
          n.zkp.proof,
          n.zkp.publicSignals
        );
        return { userId: n.userId, valid };
      })
    );

    const failedVerifications = verificationResults.filter((r) => !r.valid);
    if (failedVerifications.length > 0) {
      const failedIds = failedVerifications.map((r) => r.userId).join(", ");
      logger.error(
        `Proof verification failed for voters: ${failedIds}. Aborting batch.`
      );
      return false;
    }

    logger.debug("All proofs verified successfully");

    // Insert nullification rows
    const records = nullifications.map((n) => ({
      election_id: electionId,
      user_id: n.userId,
      nullifier_ciphertext: {
        c1: {
          x: n.ciphertext.c1.x.toString(),
          y: n.ciphertext.c1.y.toString(),
        },
        c2: {
          x: n.ciphertext.c2.x.toString(),
          y: n.ciphertext.c2.y.toString(),
        },
      },
      nullifier_zkp: n.zkp as unknown as Json,
    }));

    const { error } = await supabase.from("nullifications").insert(records);

    if (error) {
      logger.error("Error storing nullification batch:", error);
      return false;
    }

    // Update each accumulator with optimistic locking
    for (const n of nullifications) {
      const updated = await updateAccumulator(
        electionId,
        n.userId,
        n.newAccumulator,
        n.accumulatorVersion
      );
      if (!updated) {
        logger.error(
          `Failed to update accumulator for voter ${n.userId} (version conflict)`
        );
        return false;
      }
    }

    logger.debug(
      `Successfully stored batch of ${nullifications.length} nullifications and updated accumulators`
    );
    return true;
  } catch (error) {
    logger.error("Error in storeNullificationBatchWithAccumulators:", error);
    return false;
  }
}

// Legacy batch store (without accumulator updates)
export async function storeNullificationBatch(
  electionId: string,
  nullifications: Array<{
    userId: string;
    ciphertext: ElGamalCiphertext;
    zkp: { proof: Groth16Proof; publicSignals: string[] };
  }>
): Promise<boolean> {
  try {
    logger.debug(
      `Storing batch of ${nullifications.length} nullifications for election ${electionId}`
    );

    const records = nullifications.map((n) => ({
      election_id: electionId,
      user_id: n.userId,
      nullifier_ciphertext: {
        c1: {
          x: n.ciphertext.c1.x.toString(),
          y: n.ciphertext.c1.y.toString(),
        },
        c2: {
          x: n.ciphertext.c2.x.toString(),
          y: n.ciphertext.c2.y.toString(),
        },
      },
      nullifier_zkp: n.zkp as unknown as Json,
    }));

    const { error } = await supabase.from("nullifications").insert(records);

    if (error) {
      logger.error("Error storing nullification batch:", error);
      return false;
    }

    logger.debug(
      `Successfully stored batch of ${nullifications.length} nullifications`
    );
    return true;
  } catch (error) {
    logger.error("Error in storeNullificationBatch:", error);
    return false;
  }
}

// Get nullifications for an election (for election authority use)
export async function getNullificationsForElection(
  electionId: string
): Promise<Nullification[]> {
  try {
    logger.debug(`Fetching nullifications for election: ${electionId}`);

    const { data, error } = await supabase
      .from("nullifications")
      .select("*")
      .eq("election_id", electionId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching nullifications:", error);
      return [];
    }

    logger.debug(`Found ${data?.length || 0} nullifications for election`);
    return (data || []) as Nullification[];
  } catch (error) {
    logger.error("Error in getNullificationsForElection:", error);
    return [];
  }
}
