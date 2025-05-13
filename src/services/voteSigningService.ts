
import { BabyJubjubKeyPair, initBabyJubjub, signWithKeypair, generateNullifier, getPublicKeyString } from '@/services/babyJubjubService';
import { Election } from '@/types/election';

// Initialize BabyJubjub
export const initBabyJubjub = async (): Promise<void> => {
  await initBabyJubjub();
};

// Sign a vote message with the private key
export const signVote = async (
  electionId: string,
  choice: string,
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  // Create the message to be signed
  const message = JSON.stringify({
    electionId,
    choice,
    timestamp: Date.now()
  });
  
  // Sign with the keypair
  return signWithKeypair(message, keypair);
};

// Create a vote proof for submission
export const createVoteProof = async (
  electionId: string,
  optionIndex: number,
  userId: string,
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  // Get the choice name
  const choice = optionIndex === 0 ? "option1" : "option2";
  
  // Generate nullifier to prevent double voting
  const nullifier = await generateNullifier(electionId, keypair);
  
  // Create vote data
  const voteData = {
    electionId,
    choice,
    nullifier,
    timestamp: Date.now()
  };
  
  // Sign vote data
  const message = JSON.stringify(voteData);
  const signature = await signWithKeypair(message, keypair);
  
  // Create the complete proof
  const proof = {
    userId,
    choice,
    nullifier,
    signature,
    publicKey: getPublicKeyString(keypair.publicKey),
    timestamp: voteData.timestamp
  };
  
  return JSON.stringify(proof);
};

// Check if user has voted in an election
export const hasVoted = async (
  election: Election | undefined,
  userId: string | null
): Promise<boolean> => {
  if (!election || !userId) return false;
  
  // If the user has a vote in the election, they've voted
  return election.votes.some(vote => vote.voter === userId);
};

// Re-export this function from babyJubjubService
export { getPublicKeyString } from '@/services/babyJubjubService';
