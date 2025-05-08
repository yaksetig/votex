
import { buildBabyjub } from 'circomlibjs';
import { ethers } from 'ethers';

// Define interfaces
export interface BabyJubjubKeyPair {
  privateKey: string; // Store as hex string
  publicKey: [string, string]; // [x, y] coordinates as hex strings
}

// Global instance
let babyJubjub: any = null;

// Initialize Baby Jubjub library (asynchronous)
export const initBabyJubjub = async (): Promise<void> => {
  if (!babyJubjub) {
    try {
      console.log("Initializing Baby Jubjub...");
      babyJubjub = await buildBabyjub();
      console.log("Baby Jubjub initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Baby Jubjub:", error);
      throw error;
    }
  }
};

// Generate a new keypair using a simplified approach
export const generateKeypair = async (): Promise<BabyJubjubKeyPair> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  try {
    console.log("Generating random private key...");
    
    // Generate a random scalar for private key (using ethers)
    const randomHex = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const privateKeyBigInt = ethers.BigNumber.from(randomHex).mod(
      ethers.BigNumber.from("21888242871839275222246405745257275088548364400416034343698204186575808495617")
    );
    const privateKey = privateKeyBigInt.toHexString();
    
    console.log("Converting private key to field element...");
    // Convert to field element
    const Fr = babyJubjub.F.e(privateKeyBigInt.toString());
    
    // Derive public key point
    console.log("Deriving public key...");
    const publicKeyPoint = babyJubjub.mulPointEscalar(babyJubjub.Base8, Fr);
    
    // Convert points to strings
    const publicKeyX = babyJubjub.F.toString(publicKeyPoint[0]);
    const publicKeyY = babyJubjub.F.toString(publicKeyPoint[1]);
    
    console.log("Keypair generated successfully");
    
    return {
      privateKey,
      publicKey: [publicKeyX, publicKeyY]
    };
  } catch (error) {
    console.error("Error generating Baby Jubjub keypair:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    throw error;
  }
};

// Store keypair in localStorage (simplified)
export const storeKeypair = (keypair: BabyJubjubKeyPair): void => {
  try {
    localStorage.setItem('anonymous-keypair', JSON.stringify(keypair));
    console.log("Keypair stored in localStorage");
  } catch (error) {
    console.error("Error storing keypair:", error);
    throw error;
  }
};

// Retrieve keypair from localStorage (simplified)
export const retrieveKeypair = async (): Promise<BabyJubjubKeyPair | null> => {
  try {
    const storedKeypair = localStorage.getItem('anonymous-keypair');
    
    if (!storedKeypair) {
      console.log("No keypair found in storage");
      return null;
    }
    
    const keypair = JSON.parse(storedKeypair) as BabyJubjubKeyPair;
    console.log("Retrieved keypair from localStorage");
    return keypair;
  } catch (error) {
    console.error('Error retrieving keypair:', error);
    return null;
  }
};

// Sign a message (simplified)
export const signMessage = async (message: string, keypair: BabyJubjubKeyPair): Promise<string> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  try {
    // Convert message to bytes and hash it with Poseidon
    const msgBytes = ethers.utils.toUtf8Bytes(message);
    const fieldElements = Array.from(msgBytes).map(b => babyJubjub.F.e(b));
    const msgHash = babyJubjub.F.e(babyJubjub.poseidon(fieldElements));

    // Convert private key from hex string to the proper format
    const privateKeyBigInt = ethers.BigNumber.from(keypair.privateKey).toString();
    const Fr = babyJubjub.F.e(privateKeyBigInt);
    
    // Sign the message
    const signature = babyJubjub.signPoseidon(Fr, msgHash);
    
    return JSON.stringify({
      R8: [
        babyJubjub.F.toString(signature.R8[0]), 
        babyJubjub.F.toString(signature.R8[1])
      ],
      S: babyJubjub.F.toString(signature.S)
    });
  } catch (error) {
    console.error("Error signing message:", error);
    throw error;
  }
};

// For backwards compatibility with existing code
export const signWithKeypair = signMessage;

// Generate a nullifier for an election (simplified)
export const generateNullifier = async (
  electionId: string, 
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }
  
  try {
    // Create a unique string for this election and keypair
    const nullifierInput = `nullifier:${electionId}`;
    
    // Hash it with Poseidon
    const msgBytes = ethers.utils.toUtf8Bytes(nullifierInput);
    const fieldElements = Array.from(msgBytes).map(b => babyJubjub.F.e(b));
    const nullifierHash = babyJubjub.F.e(babyJubjub.poseidon(fieldElements));
    
    // Convert private key from hex string to the proper format
    const privateKeyBigInt = ethers.BigNumber.from(keypair.privateKey).toString();
    const Fr = babyJubjub.F.e(privateKeyBigInt);
    
    // Multiply by private key to create a unique point
    const nullifierPoint = babyJubjub.mulPointEscalar(
      babyJubjub.Base8, 
      babyJubjub.F.add(Fr, nullifierHash)
    );
    
    // Just use X coordinate as the nullifier
    return babyJubjub.F.toString(nullifierPoint[0]);
  } catch (error) {
    console.error("Error generating nullifier:", error);
    throw error;
  }
};

// Get public key string for storage/identification
export const getPublicKeyString = (publicKey: [string, string]): string => {
  return JSON.stringify(publicKey);
};

// Verify a signature (for compatibility and testing)
export const verifySignature = async (
  message: string,
  signatureStr: string,
  publicKey: [string, string]
): Promise<boolean> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  try {
    // Parse the signature
    const signature = JSON.parse(signatureStr);
    
    // Convert message to bytes and hash it with Poseidon
    const msgBytes = ethers.utils.toUtf8Bytes(message);
    const fieldElements = Array.from(msgBytes).map(b => babyJubjub.F.e(b));
    const msgHash = babyJubjub.F.e(babyJubjub.poseidon(fieldElements));
    
    // Convert back from string format
    const R8 = [babyJubjub.F.e(signature.R8[0]), babyJubjub.F.e(signature.R8[1])];
    const S = babyJubjub.F.e(signature.S);
    const pubKey = [babyJubjub.F.e(publicKey[0]), babyJubjub.F.e(publicKey[1])];
    
    // Verify
    const result = babyJubjub.verifyPoseidon(msgHash, { R8, S }, pubKey);
    return result;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
};

// Helper to create a keypair from World ID proof
export const createKeypairFromWorldIDProof = async (worldIdProof: any): Promise<BabyJubjubKeyPair> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  try {
    console.log("Creating keypair from World ID proof...");
    
    // Create a deterministic seed based on the nullifier_hash
    const seedHex = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`worldid-seed:${worldIdProof.nullifier_hash}`)
    );
    
    // Use this seed to generate a deterministic private key
    const privateKeyBigInt = ethers.BigNumber.from(seedHex).mod(
      ethers.BigNumber.from("21888242871839275222246405745257275088548364400416034343698204186575808495617")
    );
    const privateKey = privateKeyBigInt.toHexString();
    
    // Convert to field element
    const Fr = babyJubjub.F.e(privateKeyBigInt.toString());
    
    // Derive public key point
    const publicKeyPoint = babyJubjub.mulPointEscalar(babyJubjub.Base8, Fr);
    
    // Convert points to strings
    const publicKeyX = babyJubjub.F.toString(publicKeyPoint[0]);
    const publicKeyY = babyJubjub.F.toString(publicKeyPoint[1]);
    
    console.log("World ID derived keypair generated successfully");
    
    return {
      privateKey,
      publicKey: [publicKeyX, publicKeyY]
    };
  } catch (error) {
    console.error("Error creating keypair from World ID proof:", error);
    throw error;
  }
};
