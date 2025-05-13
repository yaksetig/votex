
import { ISuccessResult } from '@worldcoin/idkit';

// Simple interface to represent a WorldID verification result
export interface WorldIDVerificationResult {
  nullifierHash: string;
  merkleRoot: string;
  verified: boolean;
}

// Simple function to process a WorldID verification result
export function processWorldIDVerification(proof: ISuccessResult): WorldIDVerificationResult {
  return {
    nullifierHash: proof.nullifier_hash,
    merkleRoot: proof.merkle_root,
    verified: true
  };
}

// Store the WorldID verification in localStorage
export function storeWorldIDVerification(userId: string): void {
  try {
    localStorage.setItem('worldid-user', userId);
    console.log("WorldID verification stored in localStorage");
  } catch (error) {
    console.error("Error storing WorldID verification:", error);
    throw error;
  }
}
