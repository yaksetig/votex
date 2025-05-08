
import { Election, VoteCount } from "@/types/election";

/**
 * Check if the current user has voted in an election
 */
export const userHasVoted = async (election: Election | undefined, userId: string | null): Promise<boolean> => {
  if (!election || !userId) return false;
  
  try {
    // Generate a simple nullifier based on the election ID and user ID
    const nullifier = generateSimpleNullifier(election.id, userId);
    
    // Check if this nullifier exists in the votes for this election
    const matchingVote = election.votes.some(vote => vote.nullifier === nullifier);
    
    return matchingVote;
  } catch (error) {
    console.error("Error checking if user has voted:", error);
    return false;
  }
};

/**
 * Count votes for each option in an election
 */
export const getVoteCount = (election: Election | undefined): VoteCount => {
  if (!election) return { option1: 0, option2: 0 };
  
  const option1Count = election.votes.filter((vote) => vote.choice === election.option1).length;
  const option2Count = election.votes.filter((vote) => vote.choice === election.option2).length;
  
  return { option1: option1Count, option2: option2Count };
};

/**
 * Generate a simple proof for voting
 */
export const generateProof = async (
  electionId: string,
  optionIndex: number,
  userId: string
): Promise<string> => {
  try {
    // Generate a unique nullifier for this user and election
    const nullifier = generateSimpleNullifier(electionId, userId);
    
    // Create a simple proof object
    const proof = {
      userId: userId,
      nullifier,
      choice: optionIndex === 0 ? "option1" : "option2", // Convert index to option name
      timestamp: Date.now(),
    };
    
    // Return the stringified proof
    return JSON.stringify(proof);
  } catch (error) {
    console.error("Error generating proof:", error);
    throw new Error("Failed to generate vote proof");
  }
};

/**
 * Generate a simple nullifier from election ID and user ID
 */
export const generateSimpleNullifier = (electionId: string, userId: string): string => {
  // Simple hash-like function combining electionId and userId
  const combined = `${electionId}-${userId}`;
  return btoa(combined); // Base64 encode for brevity
};
