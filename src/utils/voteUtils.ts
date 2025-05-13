
import { Election, VoteCount } from "@/types/election";
import { 
  BabyJubjubKeyPair, 
  signWithKeypair, 
  generateNullifier, 
  getPublicKeyString 
} from '@/services/enhancedBabyJubjubService';

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
 * Generate a proof with BabyJubjub signature for voting
 */
export const generateProof = async (
  electionId: string,
  optionIndex: number,
  userId: string,
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  try {
    // Generate a cryptographic nullifier for this user and election
    const nullifier = await generateNullifier(electionId, keypair);
    
    // Get choice from option index
    const choice = optionIndex === 0 ? "option1" : "option2";
    
    // Data to sign - include all relevant voting information
    const voteData = {
      electionId,
      choice,
      nullifier,
      timestamp: Date.now(),
    };
    
    // Sign the vote data with the Baby Jubjub keypair
    const message = JSON.stringify(voteData);
    const signature = await signWithKeypair(message, keypair);
    
    // Create a proof object with signature
    const proof = {
      userId, 
      nullifier,
      choice,
      timestamp: voteData.timestamp,
      signature,
      publicKey: getPublicKeyString(keypair.publicKey)
    };
    
    console.log("Generated vote proof:", {
      electionId,
      userId: userId,
      choice,
      nullifier: nullifier.substring(0, 10) + "...",
      hasSignature: !!signature,
      timestamp: voteData.timestamp
    });
    
    // Return the stringified proof
    return JSON.stringify(proof);
  } catch (error) {
    console.error("Error generating signed proof:", error);
    throw new Error("Failed to generate vote proof");
  }
};

/**
 * Generate a simple nullifier from election ID and user ID
 * This is a legacy function kept for compatibility
 */
export const generateSimpleNullifier = (electionId: string, userId: string): string => {
  // Simple hash-like function combining electionId and userId
  const combined = `${electionId}-${userId}`;
  return btoa(combined); // Base64 encode for brevity
};
