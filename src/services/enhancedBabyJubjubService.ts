
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

// Global instance of BabyJubjub
let babyJub: any = null;

// Initialize Baby Jubjub library (asynchronous)
export const initBabyJubjub = async (): Promise<void> => {
  if (!babyJub) {
    try {
      babyJub = await buildBabyjub();
      console.log("Baby Jubjub initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Baby Jubjub:", error);
      throw error;
    }
  }
};

// Generate a new keypair using Baby Jubjub curve
export const generateKeypair = async (): Promise<BabyJubjubKeyPair> => {
  if (!babyJub) {
    await initBabyJubjub();
  }

  try {
    // Generate a random private key (as a BigInt)
    // We'll use ethers to generate a random value, then convert to the format needed by Baby Jubjub
    const randomBytes = ethers.utils.randomBytes(32);
    
    // Convert to a buffer that circomlibjs can handle
    // The key needs to be a field element in the Baby Jubjub curve
    const Fr = babyJub.F.e(randomBytes);
    const privateKey = babyJub.F.toObject(Fr);
    
    // Convert back to a properly sized Uint8Array for storage
    const privateKeyBytes = ethers.utils.arrayify(
      ethers.BigNumber.from(privateKey).toHexString().padStart(66, '0x0')
    );
    
    // Derive public key from private key using Baby Jubjub
    const publicKey = babyJub.mulPointEscalar(babyJub.Base8, Fr);
    
    // Convert the public key points to Uint8Array for consistent storage
    const publicKeyX = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(publicKey[0])).toHexString().padStart(66, '0x0')
    );
    
    const publicKeyY = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(publicKey[1])).toHexString().padStart(66, '0x0')
    );
    
    return {
      privateKey: privateKeyBytes,
      publicKey: [publicKeyX, publicKeyY]
    };
  } catch (error) {
    console.error("Error generating Baby Jubjub keypair:", error);
    throw error;
  }
};

// Generate a keypair derived from a WorldID proof
export const createKeypairFromWorldIDProof = async (proof: ISuccessResult): Promise<BabyJubjubKeyPair> => {
  // Initialize Baby Jubjub if not already done
  if (!babyJub) {
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
  const Fr = babyJub.F.e(privateKey);
  const publicKey = babyJub.mulPointEscalar(babyJub.Base8, Fr);
  
  // Convert the public key points to Uint8Array for consistent storage
  const publicKeyX = ethers.utils.arrayify(
    ethers.BigNumber.from(babyJub.F.toObject(publicKey[0])).toHexString().padStart(66, '0x0')
  );
  
  const publicKeyY = ethers.utils.arrayify(
    ethers.BigNumber.from(babyJub.F.toObject(publicKey[1])).toHexString().padStart(66, '0x0')
  );
  
  return {
    privateKey,
    publicKey: [publicKeyX, publicKeyY]
  };
};

// Store keypair in localStorage
export const storeKeypair = (keypair: BabyJubjubKeyPair): void => {
  try {
    const serialized: SerializedBabyJubjubKeyPair = {
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
};

// Retrieve keypair from localStorage
export const retrieveKeypair = async (): Promise<BabyJubjubKeyPair | null> => {
  if (!babyJub) {
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

// Create a hash of a message
export const hashMessage = async (message: string): Promise<any> => {
  if (!babyJub) {
    await initBabyJubjub();
  }
  
  // Convert message to bytes
  const msgBytes = ethers.utils.toUtf8Bytes(message);
  
  // Create field elements from bytes
  const fieldElements = Array.from(msgBytes).map(b => babyJub.F.e(b));
  
  // Use Poseidon hash (ZK-friendly)
  return babyJub.F.e(babyJub.poseidon(fieldElements));
};

// Sign a message with a keypair
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeyPair): Promise<string> => {
  if (!babyJub) {
    await initBabyJubjub();
  }

  if (!keypair) {
    throw new Error('No keypair provided for signing');
  }
  
  try {
    // Convert private key to the format expected by Baby Jubjub
    const privateKeyBigInt = ethers.BigNumber.from('0x' + Buffer.from(keypair.privateKey).toString('hex')).toBigInt();
    
    // Hash the message with Poseidon
    const msgHash = await hashMessage(message);
    
    // Sign the hash with private key
    const signature = babyJub.signPoseidon(privateKeyBigInt, msgHash);
    
    // Return signature as JSON string
    return JSON.stringify({
      R8: [signature.R8[0].toString(), signature.R8[1].toString()],
      S: signature.S.toString()
    });
  } catch (error) {
    console.error("Error signing message:", error);
    throw error;
  }
};

// Verify a signature
export const verifySignature = async (
  message: string,
  signatureStr: string,
  publicKey: [Uint8Array, Uint8Array]
): Promise<boolean> => {
  if (!babyJub) {
    await initBabyJubjub();
  }

  try {
    // Hash the message with the same hash function used for signing
    const msgHash = await hashMessage(message);
    
    // Parse signature
    const signature = JSON.parse(signatureStr);
    const sig = {
      R8: [babyJub.F.e(signature.R8[0]), babyJub.F.e(signature.R8[1])],
      S: babyJub.F.e(signature.S)
    };
    
    // Convert public key to the format expected by Baby Jubjub
    const pubKeyX = babyJub.F.e('0x' + Buffer.from(publicKey[0]).toString('hex'));
    const pubKeyY = babyJub.F.e('0x' + Buffer.from(publicKey[1]).toString('hex'));
    const pubKey = [pubKeyX, pubKeyY];
    
    // Verify the signature
    return babyJub.verifyPoseidon(msgHash, sig, pubKey);
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
};

// Generate a nullifier for an election
export const generateNullifier = async (
  electionId: string, 
  keypair: BabyJubjubKeyPair
): Promise<string> => {
  if (!babyJub) {
    await initBabyJubjub();
  }
  
  try {
    // Create a unique string for this election and keypair
    const nullifierInput = `nullifier:${electionId}`;
    
    // Hash it with Poseidon
    const nullifierHash = await hashMessage(nullifierInput);
    
    // Convert private key to the format expected by Baby Jubjub
    const privateKeyBigInt = ethers.BigNumber.from('0x' + Buffer.from(keypair.privateKey).toString('hex')).toBigInt();
    const privateKeyFr = babyJub.F.e(privateKeyBigInt);
    
    // Multiply by private key to create a unique point that only this user can generate
    // But which doesn't reveal the private key
    const nullifierPoint = babyJub.mulPointEscalar(
      babyJub.Base8, 
      babyJub.F.add(privateKeyFr, nullifierHash)
    );
    
    // Convert to a string representation - just use X coordinate
    return ethers.BigNumber.from(babyJub.F.toObject(nullifierPoint[0])).toHexString();
  } catch (error) {
    console.error("Error generating nullifier:", error);
    throw error;
  }
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
