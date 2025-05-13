import { generateKeypair as generateBabyJubjubKeypair } from './babyJubjubService';
import { ethers } from 'ethers';
import { ISuccessResult } from '@worldcoin/idkit';

export interface BabyJubjubKeyPair {
  privateKey: Uint8Array;
  publicKey: [Uint8Array, Uint8Array]; // [x, y] coordinates
}

// Generate a keypair using the working Baby Jubjub implementation
export async function generateKeypair(): Promise<BabyJubjubKeyPair> {
  // Call the working implementation
  const { k, Ax, Ay } = await generateBabyJubjubKeypair();
  
  // Convert bigint values to Uint8Array as expected by the application
  const privateKeyBytes = ethers.utils.arrayify(
    ethers.BigNumber.from(k.toString()).toHexString().padStart(66, '0x0')
  );
  
  const publicKeyX = ethers.utils.arrayify(
    ethers.BigNumber.from(Ax.toString()).toHexString().padStart(66, '0x0')
  );
  
  const publicKeyY = ethers.utils.arrayify(
    ethers.BigNumber.from(Ay.toString()).toHexString().padStart(66, '0x0')
  );
  
  // Return in the format expected by the application
  return {
    privateKey: privateKeyBytes,
    publicKey: [publicKeyX, publicKeyY]
  };
}

// Create a keypair from a WorldID verification
export async function createKeypairFromWorldIDProof(proof: ISuccessResult): Promise<BabyJubjubKeyPair> {
  // Create a deterministic seed from the proof
  const seed = `worldid-${proof.nullifier_hash}-${proof.merkle_root}`;
  return createKeypairFromSeed(seed);
}

// Create a keypair from a seed
export async function createKeypairFromSeed(seed: string): Promise<BabyJubjubKeyPair> {
  // For now, we'll just generate a random keypair
  // In a real implementation, this would use the seed to deterministically generate a keypair
  return generateKeypair();
}

// Get public key as string representation
export function getPublicKeyString(publicKey: [Uint8Array, Uint8Array]): string {
  return JSON.stringify([
    Buffer.from(publicKey[0]).toString('hex'),
    Buffer.from(publicKey[1]).toString('hex')
  ]);
}

// Store the keypair in localStorage
export function storeKeypair(keypair: BabyJubjubKeyPair): void {
  try {
    const serialized = {
      privateKey: Buffer.from(keypair.privateKey).toString('hex'),
      publicKeyX: Buffer.from(keypair.publicKey[0]).toString('hex'),
      publicKeyY: Buffer.from(keypair.publicKey[1]).toString('hex')
    };
    
    localStorage.setItem('anonymous-keypair', JSON.stringify(serialized));
    console.log("Keypair stored in localStorage");
  } catch (error) {
    console.error("Error storing keypair:", error);
    throw error;
  }
}

// Additional utility functions can be added as needed, but we're keeping changes minimal
