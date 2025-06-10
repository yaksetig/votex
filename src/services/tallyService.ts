
import { supabase } from "@/integrations/supabase/client";
import { getNullificationsForElection } from "@/services/nullificationService";
import { getElectionAuthorityForElection } from "@/services/electionAuthorityService";
import { 
  addElGamalCiphertexts, 
  decryptElGamalInExponent, 
  generateDiscreteLogTable,
  reconstructElGamalCiphertext 
} from "@/services/elGamalTallyService";

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
): Promise<{ aggregatedCiphertext: any; nullificationCount: number } | null> {
  try {
    console.log(`Aggregating nullifications for user ${userId} in election ${electionId}`);
    
    const nullifications = await getNullificationsForElection(electionId);
    const userNullifications = nullifications.filter(n => n.user_id === userId);
    
    if (userNullifications.length === 0) {
      console.log(`No nullifications found for user ${userId}`);
      return { aggregatedCiphertext: null, nullificationCount: 0 };
    }
    
    console.log(`Found ${userNullifications.length} nullifications for user ${userId}`);
    
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
    console.error("Error aggregating user nullifications:", error);
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
    console.log(`Processing election tally for election: ${electionId}`);
    
    // Get all participants who have voted in this election
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("voter")
      .eq("election_id", electionId);
      
    if (votesError) {
      console.error("Error fetching votes:", votesError);
      return null;
    }
    
    // Get unique voters
    const uniqueVoters = [...new Set(votes?.map(v => v.voter) || [])];
    console.log(`Found ${uniqueVoters.length} unique voters`);
    
    // Generate discrete log lookup table
    const lookupTable = generateDiscreteLogTable(100);
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
        
        // Decrypt to get the nullification count
        const decryptedCount = decryptElGamalInExponent(
          aggregatedCiphertext, 
          privateKey, 
          lookupTable
        );
        
        if (decryptedCount !== null) {
          nullificationCount = decryptedCount;
          // Apply parity rule: odd count nullifies the vote
          voteNullified = nullificationCount % 2 === 1;
        }
      }
      
      results.push({
        userId,
        nullificationCount,
        voteNullified
      });
      
      console.log(`User ${userId}: ${nullificationCount} nullifications, vote nullified: ${voteNullified}`);
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
    console.error("Error processing election tally:", error);
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
    console.log(`Storing tally results for election: ${electionId}`);
    
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
      console.error("Error storing tally results:", error);
      return false;
    }
    
    console.log(`Successfully stored ${results.length} tally results`);
    return true;
  } catch (error) {
    console.error("Error in storeTallyResults:", error);
    return false;
  }
}

// Get stored tally results for an election
export async function getElectionTallyResults(electionId: string): Promise<TallyResult[]> {
  try {
    console.log(`Fetching tally results for election: ${electionId}`);
    
    const { data, error } = await supabase
      .from("election_tallies")
      .select("*")
      .eq("election_id", electionId)
      .order("processed_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching tally results:", error);
      return [];
    }
    
    return (data || []).map(item => ({
      userId: item.user_id,
      nullificationCount: item.nullification_count,
      voteNullified: item.vote_nullified
    }));
  } catch (error) {
    console.error("Error in getElectionTallyResults:", error);
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
    // Get all votes for the election
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("voter, choice")
      .eq("election_id", electionId);
      
    if (votesError) {
      console.error("Error fetching votes:", votesError);
      return null;
    }
    
    // Get tally results
    const tallyResults = await getElectionTallyResults(electionId);
    const nullifiedUsers = new Set(
      tallyResults.filter(r => r.voteNullified).map(r => r.userId)
    );
    
    // Calculate preliminary results (all votes)
    const preliminaryResults = { option1: 0, option2: 0 };
    const finalResults = { option1: 0, option2: 0 };
    let nullifiedVotes = 0;
    
    for (const vote of votes || []) {
      // Count in preliminary results
      if (vote.choice === 'option1') {
        preliminaryResults.option1++;
      } else if (vote.choice === 'option2') {
        preliminaryResults.option2++;
      }
      
      // Count in final results only if not nullified
      if (!nullifiedUsers.has(vote.voter)) {
        if (vote.choice === 'option1') {
          finalResults.option1++;
        } else if (vote.choice === 'option2') {
          finalResults.option2++;
        }
      } else {
        nullifiedVotes++;
      }
    }
    
    return {
      preliminaryResults,
      finalResults,
      nullifiedVotes
    };
  } catch (error) {
    console.error("Error calculating final results:", error);
    return null;
  }
}
