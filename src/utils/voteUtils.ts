import { Election, VoteCount } from "@/types/election";
import { BabyJubjubKeyPair, generateNullifier, signMessage, getPublicKeyString } from "@/services/ffjavascriptBabyJubjubService";

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

// Add the generateProof function to create a proof of vote
export const generateProof = async (
  electionId: string,
  optionIndex: number,
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  try {
    // Generate a unique nullifier for this user and election
    const nullifier = await generateNullifier(electionId, keypair);
    
    // Create a message with the election ID and vote choice
    const message = `vote:${electionId}:option:${optionIndex}`;
    
    // Sign the message with the private key
    const signature = await signMessage(message, keypair);
    
    // Create a proof object
    const proof = {
      publicKey: getPublicKeyString(keypair.publicKey),
      signature,
      nullifier,
      choice: optionIndex === 0 ? "option1" : "option2", // Convert index to option name
    };
    
    // Return the stringified proof
    return JSON.stringify(proof);
  } catch (error) {
    console.error("Error generating proof:", error);
    throw new Error("Failed to generate vote proof");
  }
};
