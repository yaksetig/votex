
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/services/logger";

export interface VoteData {
  totalYesVotes: number;
  totalNoVotes: number;
  validYesVotes: number;
  validNoVotes: number;
  nullifiedYesVotes: number;
  nullifiedNoVotes: number;
}

// Get comprehensive vote data for an election using the new tracking tables
export async function getElectionVoteData(electionId: string): Promise<VoteData | null> {
  try {
    logger.debug(`Fetching vote data for election: ${electionId}`);
    
    // Get Yes votes
    const { data: yesVotes, error: yesError } = await supabase
      .from("yes_votes")
      .select("*")
      .eq("election_id", electionId);
      
    if (yesError) {
      logger.error("Error fetching yes votes:", yesError);
      return null;
    }
    
    // Get No votes
    const { data: noVotes, error: noError } = await supabase
      .from("no_votes")
      .select("*")
      .eq("election_id", electionId);
      
    if (noError) {
      logger.error("Error fetching no votes:", noError);
      return null;
    }
    
    const totalYesVotes = yesVotes?.length || 0;
    const totalNoVotes = noVotes?.length || 0;
    const nullifiedYesVotes = yesVotes?.filter(vote => vote.nullified).length || 0;
    const nullifiedNoVotes = noVotes?.filter(vote => vote.nullified).length || 0;
    const validYesVotes = totalYesVotes - nullifiedYesVotes;
    const validNoVotes = totalNoVotes - nullifiedNoVotes;
    
    const voteData = {
      totalYesVotes,
      totalNoVotes,
      validYesVotes,
      validNoVotes,
      nullifiedYesVotes,
      nullifiedNoVotes
    };
    
    logger.debug('Vote data calculated:', voteData);
    
    return voteData;
  } catch (error) {
    logger.error("Error in getElectionVoteData:", error);
    return null;
  }
}

// Record a vote in the appropriate tracking table
// isOption1 should be true if the choice matches the election's option1
export async function recordVote(electionId: string, voterId: string, isOption1: boolean): Promise<boolean> {
  try {
    logger.debug(`Recording vote: election=${electionId}, voter=${voterId}, isOption1=${isOption1}`);
    
    const tableName = isOption1 ? 'yes_votes' : 'no_votes';
    
    const { error } = await supabase
      .from(tableName)
      .upsert({
        election_id: electionId,
        voter_id: voterId,
        nullified: false,
        nullification_count: 0
      }, {
        onConflict: 'election_id,voter_id'
      });
    
    if (error) {
      logger.error(`Error recording vote in ${tableName}:`, error);
      return false;
    }
    
    logger.debug(`Vote recorded successfully in ${tableName}`);
    return true;
  } catch (error) {
    logger.error("Error in recordVote:", error);
    return false;
  }
}

// Update nullification status for a voter
export async function updateVoteNullification(
  electionId: string, 
  voterId: string, 
  nullificationCount: number,
  isNullified: boolean
): Promise<boolean> {
  try {
    logger.debug(`Updating nullification: election=${electionId}, voter=${voterId}, count=${nullificationCount}, nullified=${isNullified}`);
    
    // Check if voter has a Yes vote
    const { data: yesVote } = await supabase
      .from("yes_votes")
      .select("*")
      .eq("election_id", electionId)
      .eq("voter_id", voterId)
      .single();
    
    // Check if voter has a No vote
    const { data: noVote } = await supabase
      .from("no_votes")
      .select("*")
      .eq("election_id", electionId)
      .eq("voter_id", voterId)
      .single();
    
    let tableName: string;
    if (yesVote) {
      tableName = 'yes_votes';
    } else if (noVote) {
      tableName = 'no_votes';
    } else {
      logger.error("No vote found for voter in either table");
      return false;
    }
    
    const { error } = await supabase
      .from(tableName)
      .update({
        nullification_count: nullificationCount,
        nullified: isNullified,
        updated_at: new Date().toISOString()
      })
      .eq("election_id", electionId)
      .eq("voter_id", voterId);
    
    if (error) {
      logger.error(`Error updating nullification in ${tableName}:`, error);
      return false;
    }
    
    logger.debug(`Nullification updated successfully in ${tableName}`);
    return true;
  } catch (error) {
    logger.error("Error in updateVoteNullification:", error);
    return false;
  }
}
