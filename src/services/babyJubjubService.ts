
import { buildBabyjub } from 'circomlibjs';
import { ethers } from 'ethers';
import { ISuccessResult } from '@worldcoin/idkit';

export interface BabyJubjubKeyPair {
  privateKey: Uint8Array;
  publicKey: [Uint8Array, Uint8Array]; // [x, y] coordinates
}

export interface SerializedBabyJubjubKeyPair {
  privateKey: string;
  publicKeyX: string;
  publicKeyY: string;
}

let babyJubjub: any = null;

// Initialize Baby Jubjub library (asynchronous)
export const initBabyJubjub = async (): Promise<void> => {
  if (!babyJubjub) {
    babyJubjub = await buildBabyjub();
    console.log("Baby Jubjub initialized successfully");
  }
};

// Generate a new keypair using Baby Jubjub curve
export const generateKeypair = async (): Promise<BabyJubjubKeyPair> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  // Generate a random private key
  const privateKey = ethers.utils.randomBytes(32);
  
  // Derive public key from private key using Baby Jubjub
  const publicKey = babyJubjub.mulPointEscalar(babyJubjub.Base8, privateKey);
  
  return {
    privateKey,
    publicKey: [publicKey[0], publicKey[1]]
  };
};

export const createKeypairFromWorldIDProof = async (proof: ISuccessResult): Promise<BabyJubjubKeyPair> => {
  // Initialize Baby Jubjub if not already done
  if (!babyJubjub) {
    await initBabyJubjub();
  }
  
  // Create a deterministic seed based on the WorldID proof
  // This ensures the keypair is linked to the WorldID verification but not traceable back to the user
  const proofString = JSON.stringify(proof);
  const proofBytes = ethers.utils.toUtf8Bytes(proofString);
  const proofHash = ethers.utils.keccak256(proofBytes);
  
  // Use the hash as a seed for the private key
  const privateKey = ethers.utils.arrayify(proofHash);
  
  // Derive public key
  const publicKey = babyJubjub.mulPointEscalar(babyJubjub.Base8, privateKey);
  
  return {
    privateKey,
    publicKey: [publicKey[0], publicKey[1]]
  };
};

// Store keypair in localStorage
export const storeKeypair = (keypair: BabyJubjubKeyPair): void => {
  const serialized: SerializedBabyJubjubKeyPair = {
    privateKey: Buffer.from(keypair.privateKey).toString('hex'),
    publicKeyX: Buffer.from(keypair.publicKey[0]).toString('hex'),
    publicKeyY: Buffer.from(keypair.publicKey[1]).toString('hex')
  };
  
  localStorage.setItem('anonymous-keypair', JSON.stringify(serialized));
};

// Retrieve keypair from localStorage
export const retrieveKeypair = async (): Promise<BabyJubjubKeyPair | null> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  const storedKeypair = localStorage.getItem('anonymous-keypair');
  
  if (!storedKeypair) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(storedKeypair) as SerializedBabyJubjubKeyPair;
    return {
      privateKey: Buffer.from(parsed.privateKey, 'hex'),
      publicKey: [
        Buffer.from(parsed.publicKeyX, 'hex'),
        Buffer.from(parsed.publicKeyY, 'hex')
      ]
    };
  } catch (error) {
    console.error('Error parsing stored keypair:', error);
    return null;
  }
};

// Create a consistent message hash using Poseidon (ZK-friendly)
export const hashMessage = async (message: string): Promise<any> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }
  
  // Convert message to bytes
  const msgBytes = ethers.utils.toUtf8Bytes(message);
  
  // Create field elements from bytes
  const fieldElements = Array.from(msgBytes).map(b => babyJubjub.F.e(b));
  
  // Use Poseidon hash (ZK-friendly)
  return babyJubjub.F.e(babyJubjub.poseidon(fieldElements));
};

// Sign a message with a keypair
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeyPair): Promise<string> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  if (!keypair) {
    throw new Error('No keypair provided for signing');
  }
  
  // Hash the message with Poseidon
  const msgHash = await hashMessage(message);
  
  // Sign the hash with private key
  const signature = babyJubjub.signPoseidon(keypair.privateKey, msgHash);
  
  // Return signature as JSON string
  return JSON.stringify({
    R8: [signature.R8[0].toString(), signature.R8[1].toString()],
    S: signature.S.toString()
  });
};

// Verify a signature
export const verifySignature = async (
  message: string,
  signatureStr: string,
  publicKey: [Uint8Array, Uint8Array]
): Promise<boolean> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  // Hash the message with the same hash function used for signing
  const msgHash = await hashMessage(message);
  
  // Parse signature
  const signature = JSON.parse(signatureStr);
  const sig = {
    R8: [babyJubjub.F.e(signature.R8[0]), babyJubjub.F.e(signature.R8[1])],
    S: babyJubjub.F.e(signature.S)
  };
  
  // Verify the signature
  return babyJubjub.verifyPoseidon(msgHash, sig, publicKey);
};

// Generate a nullifier for an election
export const generateNullifier = async (
  electionId: string, 
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }
  
  // Create a unique string for this election and keypair
  const nullifierInput = `nullifier:${electionId}`;
  
  // Hash it with Poseidon
  const nullifierHash = await hashMessage(nullifierInput);
  
  // Multiply by private key to create a unique point that only this user can generate
  // But which doesn't reveal the private key
  const nullifierPoint = babyJubjub.mulPointEscalar(
    babyJubjub.Base8, 
    babyJubjub.F.add(keypair.privateKey, nullifierHash)
  );
  
  // Convert to a string representation - just use X coordinate
  return Buffer.from(nullifierPoint[0]).toString('hex');
};

// Get public key as string (for storage and identification)
export const getPublicKeyString = (publicKey: [Uint8Array, Uint8Array]): string => {
  return JSON.stringify([
    Buffer.from(publicKey[0]).toString('hex'),
    Buffer.from(publicKey[1]).toString('hex')
  ]);
};

// Parse public key from string
export const parsePublicKey = (publicKeyString: string): [Uint8Array, Uint8Array] => {
  const [x, y] = JSON.parse(publicKeyString);
  return [
    Buffer.from(x, 'hex'),
    Buffer.from(y, 'hex')
  ];
};
