import { supabase } from "@/integrations/supabase/client";
import { getElectionAuthorityForElection } from "@/services/electionAuthorityService";
import { updateVoteNullification } from "@/services/voteTrackingService";
import {
  decryptElGamalInExponent,
  ensureDiscreteLogTable,
} from "@/services/elGamalTallyService";
import {
  getElectionAccumulators,
  accumulatorToCiphertext,
} from "@/services/accumulatorService";
import { logger } from "@/services/logger";

export interface TallyResult {
  userId: string;
  nullificationCount: number;
  voteNullified: boolean;
}

export interface ElectionTallyResult {
  electionId: string;
  results: TallyResult[];
  processedAt: string;
  processedBy?: string;
}

// Process the entire election tally using the authority's private key.
// With XOR accumulators, each voter's accumulator decrypts to either
// 0 (vote valid) or 1 (vote nullified). No count leakage.
export async function processElectionTally(
  electionId: string,
  authorityPrivateKey: string,
  processedBy?: string
): Promise<ElectionTallyResult | null> {
  try {
    logger.debug(`Processing election tally for election: ${electionId}`);

    // Ensure discrete log table has at least 0 and 1
    const tableInitialized = await ensureDiscreteLogTable(2);
    if (!tableInitialized) {
      logger.error("Failed to initialize discrete log table");
      return null;
    }

    // Fetch all XOR accumulators for this election
    const accumulators = await getElectionAccumulators(electionId);
    logger.debug(
      `Found ${accumulators.length} voter accumulators for election`
    );

    const privateKey = BigInt(authorityPrivateKey);
    const results: TallyResult[] = [];

    for (const acc of accumulators) {
      const ciphertext = accumulatorToCiphertext(acc);

      // Decrypt accumulator -> should be 0 or 1
      const decryptedValue = await decryptElGamalInExponent(
        ciphertext,
        privateKey
      );

      // With XOR accumulator, the decrypted value is:
      //   0 = vote valid (even number of actual nullifications)
      //   1 = vote nullified (odd number of actual nullifications)
      const voteNullified = decryptedValue === 1;

      // Update the vote tracking tables
      await updateVoteNullification(
        electionId,
        acc.voter_id,
        decryptedValue ?? 0,
        voteNullified
      );

      results.push({
        userId: acc.voter_id,
        nullificationCount: decryptedValue ?? 0,
        voteNullified,
      });

      logger.debug(
        `Voter ${acc.voter_id}: accumulator decrypts to ${decryptedValue}, nullified: ${voteNullified}`
      );
    }

    // Also handle voters who have no accumulator (never nullified)
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
    const processedVoterIds = new Set(accumulators.map((a) => a.voter_id));

    for (const voterId of uniqueVoters) {
      if (!processedVoterIds.has(voterId)) {
        // No accumulator means no nullifications -> vote is valid
        results.push({
          userId: voterId,
          nullificationCount: 0,
          voteNullified: false,
        });
      }
    }

    await storeTallyResults(electionId, results, processedBy);

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

    const tallyData = results.map((result) => ({
      election_id: electionId,
      user_id: result.userId,
      nullification_count: result.nullificationCount,
      vote_nullified: result.voteNullified,
      processed_by: processedBy || null,
    }));

    const { error } = await supabase
      .from("election_tallies")
      .upsert(tallyData, {
        onConflict: "election_id,user_id",
        ignoreDuplicates: false,
      });

    if (error) {
      logger.error("Error storing tally results:", error);
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
    }));
  } catch (error) {
    logger.error("Error in getElectionTallyResults:", error);
    return [];
  }
}

// Calculate final vote counts after applying nullifications
export async function calculateFinalResults(electionId: string): Promise<{
  preliminaryResults: { option1: number; option2: number };
  finalResults: { option1: number; option2: number };
  nullifiedVotes: number;
} | null> {
  try {
    logger.debug(
      `Starting final results calculation for election: ${electionId}`
    );

    const { data: yesVotes, error: yesError } = await supabase
      .from("yes_votes")
      .select("*")
      .eq("election_id", electionId);

    const { data: noVotes, error: noError } = await supabase
      .from("no_votes")
      .select("*")
      .eq("election_id", electionId);

    if (yesError || noError) {
      logger.error(
        "Error fetching votes from tracking tables:",
        yesError || noError
      );
      return null;
    }

    const totalYesVotes = yesVotes?.length || 0;
    const totalNoVotes = noVotes?.length || 0;
    const nullifiedYesVotes =
      yesVotes?.filter((vote) => vote.nullified).length || 0;
    const nullifiedNoVotes =
      noVotes?.filter((vote) => vote.nullified).length || 0;
    const validYesVotes = totalYesVotes - nullifiedYesVotes;
    const validNoVotes = totalNoVotes - nullifiedNoVotes;

    const results = {
      preliminaryResults: { option1: totalYesVotes, option2: totalNoVotes },
      finalResults: { option1: validYesVotes, option2: validNoVotes },
      nullifiedVotes: nullifiedYesVotes + nullifiedNoVotes,
    };

    logger.debug("Final calculated results:", results);

    return results;
  } catch (error) {
    logger.error("Error calculating final results:", error);
    return null;
  }
}
