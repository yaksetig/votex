import { supabase } from "@/integrations/supabase/client";
import { getNullificationsForElection } from "@/services/nullificationService";
import { getElectionAuthorityForElection } from "@/services/electionAuthorityService";
import { updateVoteNullification } from "@/services/voteTrackingService";
import {
  addElGamalCiphertexts,
  decryptElGamalInExponent,
  ensureDiscreteLogTable,
  reconstructElGamalCiphertext
} from "@/services/elGamalTallyService";
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

// Aggregate all nullifications for a specific user in an election
export async function aggregateUserNullifications(
  electionId: string, 
  userId: string
): Promise<{ aggregatedCiphertext: { c1: { x: string; y: string }; c2: { x: string; y: string } } | null; nullificationCount: number } | null> {
  try {
    logger.debug(`Aggregating nullifications for user ${userId} in election ${electionId}`);
    
    const nullifications = await getNullificationsForElection(electionId);
    const userNullifications = nullifications.filter(n => n.user_id === userId);
    
    if (userNullifications.length === 0) {
      logger.debug(`No nullifications found for user ${userId}`);
      return { aggregatedCiphertext: null, nullificationCount: 0 };
    }
    
    logger.debug(`Found ${userNullifications.length} nullifications for user ${userId}`);
    
    // Convert stored ciphertexts back to ElGamalCiphertext objects
    const ciphertexts = userNullifications.map(n => 
      reconstructElGamalCiphertext(n.nullifier_ciphertext)
    );
    
    // Add all ciphertexts homomorphically
    const aggregated = addElGamalCiphertexts(ciphertexts);
    
    return {
      aggregatedCiphertext: {
        c1: {
          x: aggregated.c1.x.toString(),
          y: aggregated.c1.y.toString()
        },
        c2: {
          x: aggregated.c2.x.toString(),
          y: aggregated.c2.y.toString()
        }
      },
      nullificationCount: userNullifications.length
    };
  } catch (error) {
    logger.error("Error aggregating user nullifications:", error);
    return null;
  }
}

// Process the entire election tally using the authority's private key
export async function processElectionTally(
  electionId: string, 
  authorityPrivateKey: string,
  processedBy?: string
): Promise<ElectionTallyResult | null> {
  try {
    logger.debug(`Processing election tally for election: ${electionId}`);
    
    // Ensure discrete log table is initialized
    const tableInitialized = await ensureDiscreteLogTable(100);
    if (!tableInitialized) {
      logger.error("Failed to initialize discrete log table");
      return null;
    }
    
    // Get all participants from both vote tracking tables
    const { data: yesVotes, error: yesError } = await supabase
      .from("yes_votes")
      .select("voter_id")
      .eq("election_id", electionId);
      
    const { data: noVotes, error: noError } = await supabase
      .from("no_votes")
      .select("voter_id")
      .eq("election_id", electionId);
      
    if (yesError || noError) {
      logger.error("Error fetching votes:", yesError || noError);
      return null;
    }
    
    // Get unique voters from both tables
    const allVoterIds = [
      ...(yesVotes?.map(v => v.voter_id) || []),
      ...(noVotes?.map(v => v.voter_id) || [])
    ];
    const uniqueVoters = [...new Set(allVoterIds)];
    logger.debug(`Found ${uniqueVoters.length} unique voters`);
    
    const privateKey = BigInt(authorityPrivateKey);
    const results: TallyResult[] = [];
    
    // Process each voter's nullifications
    for (const userId of uniqueVoters) {
      const aggregation = await aggregateUserNullifications(electionId, userId);
      
      let nullificationCount = 0;
      let voteNullified = false;
      
      if (aggregation && aggregation.aggregatedCiphertext) {
        // Reconstruct the aggregated ciphertext
        const aggregatedCiphertext = reconstructElGamalCiphertext(aggregation.aggregatedCiphertext);
        
        // Decrypt to get the nullification count using Supabase lookup
        const decryptedCount = await decryptElGamalInExponent(
          aggregatedCiphertext, 
          privateKey
        );
        
        if (decryptedCount !== null) {
          nullificationCount = decryptedCount;
          // Apply parity rule: odd count nullifies the vote
          voteNullified = nullificationCount % 2 === 1;
          
          // Update the vote tracking tables with nullification status
          await updateVoteNullification(electionId, userId, nullificationCount, voteNullified);
        }
      }
      
      results.push({
        userId,
        nullificationCount,
        voteNullified
      });
      
      logger.debug(`User ${userId}: ${nullificationCount} nullifications, vote nullified: ${voteNullified}`);
    }
    
    // Store results in database
    await storeTallyResults(electionId, results, processedBy);
    
    return {
      electionId,
      results,
      processedAt: new Date().toISOString(),
      processedBy
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
    
    // Prepare data for insertion
    const tallyData = results.map(result => ({
      election_id: electionId,
      user_id: result.userId,
      nullification_count: result.nullificationCount,
      vote_nullified: result.voteNullified,
      processed_by: processedBy || null
    }));
    
    // Use upsert to handle potential reprocessing
    const { error } = await supabase
      .from("election_tallies")
      .upsert(tallyData, { 
        onConflict: 'election_id,user_id',
        ignoreDuplicates: false 
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
export async function getElectionTallyResults(electionId: string): Promise<TallyResult[]> {
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
    
    return (data || []).map(item => ({
      userId: item.user_id,
      nullificationCount: item.nullification_count,
      voteNullified: item.vote_nullified
    }));
  } catch (error) {
    logger.error("Error in getElectionTallyResults:", error);
    return [];
  }
}

// Calculate final vote counts after applying nullifications - now using vote tracking tables
export async function calculateFinalResults(electionId: string): Promise<{
  preliminaryResults: { option1: number; option2: number };
  finalResults: { option1: number; option2: number };
  nullifiedVotes: number;
} | null> {
  try {
    logger.debug(`Starting final results calculation for election: ${electionId}`);
    
    // Get vote data from tracking tables
    const { data: yesVotes, error: yesError } = await supabase
      .from("yes_votes")
      .select("*")
      .eq("election_id", electionId);
      
    const { data: noVotes, error: noError } = await supabase
      .from("no_votes")
      .select("*")
      .eq("election_id", electionId);
      
    if (yesError || noError) {
      logger.error("Error fetching votes from tracking tables:", yesError || noError);
      return null;
    }
    
    logger.debug(`Vote tracking data:`, { yesVotes, noVotes });
    
    const totalYesVotes = yesVotes?.length || 0;
    const totalNoVotes = noVotes?.length || 0;
    const nullifiedYesVotes = yesVotes?.filter(vote => vote.nullified).length || 0;
    const nullifiedNoVotes = noVotes?.filter(vote => vote.nullified).length || 0;
    const validYesVotes = totalYesVotes - nullifiedYesVotes;
    const validNoVotes = totalNoVotes - nullifiedNoVotes;
    
    const results = {
      preliminaryResults: { option1: totalYesVotes, option2: totalNoVotes },
      finalResults: { option1: validYesVotes, option2: validNoVotes },
      nullifiedVotes: nullifiedYesVotes + nullifiedNoVotes
    };
    
    logger.debug('Final calculated results:', results);
    
    return results;
  } catch (error) {
    logger.error("Error calculating final results:", error);
    return null;
  }
}
