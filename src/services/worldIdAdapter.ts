
import { ISuccessResult } from '@worldcoin/idkit';
import { 
  BabyJubjubKeyPair,
  createKeypairFromSeed,
  getPublicKeyString,
  storeKeypair,
  generateKeypair as generateBabyJubjubKeypair
} from './babyJubjubService';

// Generate a keypair 
export async function generateKeypair(): Promise<BabyJubjubKeyPair> {
  return generateBabyJubjubKeypair();
}

// Create a keypair from a WorldID verification
export async function createKeypairFromWorldIDProof(proof: ISuccessResult): Promise<BabyJubjubKeyPair> {
  // Create a deterministic seed from the proof
  const seed = `worldid-${proof.nullifier_hash}-${proof.merkle_root}`;
  return createKeypairFromSeed(seed);
}

// Re-export these functions directly
export { createKeypairFromSeed, getPublicKeyString, storeKeypair };
