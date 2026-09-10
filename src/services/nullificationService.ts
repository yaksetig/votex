import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ElGamalCiphertext } from "@/services/elGamalService";
import { Groth16Proof } from "@/types/proof";
import { logger } from "@/services/logger";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";
import { readFunctionError } from "@/types/api";

interface NullificationProof {
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

export type NullificationWriteCode =
  | "ACCUMULATOR_CONFLICT"
  | "RATE_LIMITED"
  | "ELECTION_CLOSED"
  | "NO_SESSION"
  | "UNKNOWN";

export interface NullificationWriteResult {
  ok: boolean;
  code?: NullificationWriteCode;
  message?: string;
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

function normalizeWriteCode(code: unknown): NullificationWriteCode {
  switch (code) {
    case "ACCUMULATOR_CONFLICT":
    case "RATE_LIMITED":
    case "ELECTION_CLOSED":
      return code;
    default:
      return "UNKNOWN";
  }
}

// Get nullifications for an election (for election authority use)
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
      user_id: nullification.submitter_pseudonym,
    }) as Nullification);

    logger.debug(`Found ${rows.length} nullifications for election`);
    return rows;
  } catch (error) {
    logger.error("Error in getNullificationsForElection:", error);
    return [];
  }
}
