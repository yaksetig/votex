import { supabase } from "@/integrations/supabase/client";
import {
  decryptElGamalInExponent,
  ensureDiscreteLogTable,
} from "@/services/elGamalTallyService";
import {
  getElectionAccumulators,
  accumulatorToCiphertext,
} from "@/services/accumulatorService";
import { resolveDelegations } from "@/services/delegationService";
import { getElectionParticipants } from "@/services/electionParticipantsService";
import { logger } from "@/services/logger";
import { deriveAuthorityKeyMaterial } from "@/services/eddsaService";

export interface TallyResult {
  userId: string;
  nullificationCount: number;
  voteNullified: boolean;
  voteWeight: number;
}

export interface ElectionTallyResult {
  electionId: string;
  results: TallyResult[];
  processedAt: string;
  processedBy?: string;
}

// Process the entire election tally using the authority's secret.
// With XOR accumulators, each voter's accumulator decrypts to either
// 0 (vote valid) or 1 (vote nullified). No count leakage.
export async function processElectionTally(
  electionId: string,
  authoritySecret: string,
  processedBy?: string
): Promise<ElectionTallyResult | null> {
  try {
    logger.debug(`Processing election tally for election: ${electionId}`);

    // Ensure discrete log table covers nullification (0/1) plus delegation
    // indices (up to participant count).
    const participants = await getElectionParticipants(electionId);
    const minTableSize = Math.max(2, participants.length);
    const tableInitialized = await ensureDiscreteLogTable(minTableSize);
    if (!tableInitialized) {
      logger.error("Failed to initialize discrete log table");
      return null;
    }

    // --- Phase 1: Nullification processing ---
    const accumulators = await getElectionAccumulators(electionId);
    logger.debug(
      `Found ${accumulators.length} voter accumulators for election`
    );

    const authorityKeyMaterial = await deriveAuthorityKeyMaterial(authoritySecret);
    const privateKey = authorityKeyMaterial.scalar;
    const nullificationMap = new Map<string, { count: number; nullified: boolean }>();

    for (const acc of accumulators) {
      const ciphertext = accumulatorToCiphertext(acc);
      const decryptedValue = await decryptElGamalInExponent(
        ciphertext,
        privateKey
      );

      const voteNullified = decryptedValue === 1;
      nullificationMap.set(acc.voter_id, {
        count: decryptedValue ?? 0,
        nullified: voteNullified,
      });

      logger.debug(
        `Voter ${acc.voter_id}: accumulator decrypts to ${decryptedValue}, nullified: ${voteNullified}`
      );
    }

    // --- Phase 2: Delegation resolution ---
    const { weightMap, delegatorIds } = await resolveDelegations(
      electionId,
      privateKey
    );
    logger.debug(
      `Resolved ${delegatorIds.size} delegations across ${weightMap.size} delegates`
    );

    // --- Phase 3: Build final results ---
    const { data: yesVotes } = await supabase
      .from("yes_votes")
      .select("voter_id")
      .eq("election_id", electionId);
    const { data: noVotes } = await supabase
      .from("no_votes")
      .select("voter_id")
      .eq("election_id", electionId);

    const allVoterIds = [
      ...(yesVotes?.map((v) => v.voter_id) || []),
      ...(noVotes?.map((v) => v.voter_id) || []),
    ];
    const uniqueVoters = [...new Set(allVoterIds)];

    const results: TallyResult[] = [];

    for (const voterId of uniqueVoters) {
      const nullInfo = nullificationMap.get(voterId);
      const voteNullified = nullInfo?.nullified ?? false;

      // Delegators' direct votes are ignored — their power transferred
      const isDelegator = delegatorIds.has(voterId);

      // Delegates get extra weight from their delegators
      const weight = isDelegator ? 0 : (weightMap.get(voterId) ?? 1);

      results.push({
        userId: voterId,
        nullificationCount: nullInfo?.count ?? 0,
        voteNullified: voteNullified || isDelegator,
        voteWeight: weight,
      });
    }

    // Include delegators who didn't vote directly (they have no
    // yes_votes/no_votes row but should appear in the tally as delegated)
    for (const delegatorId of delegatorIds) {
      if (!uniqueVoters.includes(delegatorId)) {
        results.push({
          userId: delegatorId,
          nullificationCount: 0,
          voteNullified: true, // their power was delegated away
          voteWeight: 0,
        });
      }
    }

    const stored = await storeTallyResults(electionId, results, processedBy);
    if (!stored) {
      logger.error("Failed to persist tally results through the authority write path");
      return null;
    }

    return {
      electionId,
      results,
      processedAt: new Date().toISOString(),
      processedBy,
    };
  } catch (error) {
    logger.error("Error processing election tally:", error);
    return null;
  }
}

// Store tally results in the database
async function storeTallyResults(
  electionId: string,
  results: TallyResult[],
  processedBy?: string
): Promise<boolean> {
  try {
    logger.debug(`Storing tally results for election: ${electionId}`);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      logger.error("Cannot persist tally results without an authenticated authority session");
      return false;
    }

    const { data, error } = await supabase.functions.invoke("authority-tally-write", {
      body: {
        action: "store-results",
        electionId,
        processedBy: processedBy || null,
        results,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      logger.error("Error storing tally results:", error);
      return false;
    }

    if (data?.error) {
      logger.error("Authority tally write was rejected:", data.error);
      return false;
    }

    logger.debug(`Successfully stored ${results.length} tally results`);
    return true;
  } catch (error) {
    logger.error("Error in storeTallyResults:", error);
    return false;
  }
}

// Get stored tally results for an election
export async function getElectionTallyResults(
  electionId: string
): Promise<TallyResult[]> {
  try {
    logger.debug(`Fetching tally results for election: ${electionId}`);

    const { data, error } = await supabase
      .from("election_tallies")
      .select("*")
      .eq("election_id", electionId)
      .order("processed_at", { ascending: false });

    if (error) {
      logger.error("Error fetching tally results:", error);
      return [];
    }

    return (data || []).map((item) => ({
      userId: item.user_id,
      nullificationCount: item.nullification_count,
      voteNullified: item.vote_nullified,
      voteWeight: item.vote_weight ?? 1,
    }));
  } catch (error) {
    logger.error("Error in getElectionTallyResults:", error);
    return [];
  }
}
