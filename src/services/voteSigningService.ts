import { BabyJubjubKeyPair } from '@/services/worldIdAdapter';
import { Election } from '@/types/election';
import { ethers } from 'ethers';
import { buildBabyjub } from 'circomlibjs';

// Global instance of BabyJubjub for signing
let babyJub: any = null;

// Initialize BabyJubjub
export const initBabyJubjub = async (): Promise<void> => {
  if (!babyJub) {
    try {
      babyJub = await buildBabyjub();
      console.log("Baby Jubjub initialized for signing");
    } catch (error) {
      console.error("Failed to initialize Baby Jubjub for signing:", error);
      throw error;
    }
  }
};

// Sign a vote message with the private key
export const signVote = async (
  electionId: string,
  choice: string,
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  // Make sure BabyJub is initialized
  await initBabyJubjub();
  
  // Create the message to be signed
  const message = JSON.stringify({
    electionId,
    choice,
    timestamp: Date.now()
  });
  
  // Convert private key to the format expected by Baby Jubjub
  const privateKeyBigInt = ethers.BigNumber.from(
    '0x' + Buffer.from(keypair.privateKey).toString('hex')
  ).toBigInt();
  
  // Create a hash of the message
  const msgBytes = ethers.utils.toUtf8Bytes(message);
  const fieldElements = Array.from(msgBytes).map(b => babyJub.F.e(b));
  const msgHash = babyJub.F.e(babyJub.poseidon(fieldElements));
  
  // Sign the hash with private key
  const signature = babyJub.signPoseidon(privateKeyBigInt, msgHash);
  
  // Return signature as JSON string
  return JSON.stringify({
    R8: [signature.R8[0].toString(), signature.R8[1].toString()],
    S: signature.S.toString()
  });
};

// Generate a nullifier to prevent double-voting
export const generateNullifier = async (
  electionId: string,
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  await initBabyJubjub();
  
  // Create a unique string for this election and keypair
  const nullifierInput = `nullifier:${electionId}`;
  
  // Hash it with Poseidon
  const msgBytes = ethers.utils.toUtf8Bytes(nullifierInput);
  const fieldElements = Array.from(msgBytes).map(b => babyJub.F.e(b));
  const nullifierHash = babyJub.F.e(babyJub.poseidon(fieldElements));
  
  // Convert private key to the format expected by Baby Jubjub
  const privateKeyBigInt = ethers.BigNumber.from(
    '0x' + Buffer.from(keypair.privateKey).toString('hex')
  ).toBigInt();
  const privateKeyFr = babyJub.F.e(privateKeyBigInt);
  
  // Create a unique point that only this user with this keypair can generate
  const nullifierPoint = babyJub.mulPointEscalar(
    babyJub.Base8,
    babyJub.F.add(privateKeyFr, nullifierHash)
  );
  
  // Return the X coordinate as the nullifier
  return ethers.BigNumber.from(
    babyJub.F.toObject(nullifierPoint[0])
  ).toHexString();
};

// Create a vote proof for submission
export const createVoteProof = async (
  electionId: string,
  optionIndex: number,
  userId: string,
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  // Initialize if needed
  await initBabyJubjub();
  
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
  const signature = await signVote(electionId, choice, keypair);
  
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

// Helper function to get public key as string
function getPublicKeyString(publicKey: [Uint8Array, Uint8Array]): string {
  return JSON.stringify([
    Buffer.from(publicKey[0]).toString('hex'),
    Buffer.from(publicKey[1]).toString('hex')
  ]);
}
