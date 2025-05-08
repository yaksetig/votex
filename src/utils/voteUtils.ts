import { Election, VoteCount } from "@/types/election";
import { BabyJubjubKeyPair, generateNullifier } from "@/services/ffjavascriptBabyJubjubService";

export const userHasVoted = async (election: Election | undefined, anonymousKeypair: BabyJubjubKeyPair | null): Promise<boolean> => {
  if (!election || !anonymousKeypair) return false;
  
  try {
    // Generate the nullifier that would have been used when voting
    const nullifier = await generateNullifier(election.id, anonymousKeypair);
    
    // Check if this nullifier exists in the votes for this election
    const matchingVote = election.votes.some(vote => vote.nullifier === nullifier);
    
    return matchingVote;
  } catch (error) {
    console.error("Error checking if user has voted:", error);
    return false;
  }
};

export const getVoteCount = (election: Election | undefined): VoteCount => {
  if (!election) return { option1: 0, option2: 0 };
  
  const option1Count = election.votes.filter((vote) => vote.choice === election.option1).length;
  const option2Count = election.votes.filter((vote) => vote.choice === election.option2).length;
  
  return { option1: option1Count, option2: option2Count };
};
