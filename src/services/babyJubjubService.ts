
import { buildBabyjub } from 'circomlibjs';
import { ethers } from 'ethers';

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

// Sign a message with a keypair
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeyPair): Promise<string> => {
  if (!babyJubjub) {
    await initBabyJubjub();
  }

  if (!keypair) {
    throw new Error('No keypair provided for signing');
  }
  
  // Convert message to bytes
  const msgBytes = ethers.utils.toUtf8Bytes(message);
  
  // Hash the message (Poseidon or other compatible hash)
  const msgHash = babyJubjub.F.e(ethers.utils.keccak256(msgBytes));
  
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

  // Convert message to bytes and hash it
  const msgBytes = ethers.utils.toUtf8Bytes(message);
  const msgHash = babyJubjub.F.e(ethers.utils.keccak256(msgBytes));
  
  // Parse signature
  const signature = JSON.parse(signatureStr);
  const sig = {
    R8: [babyJubjub.F.e(signature.R8[0]), babyJubjub.F.e(signature.R8[1])],
    S: babyJubjub.F.e(signature.S)
  };
  
  // Verify the signature
  return babyJubjub.verifyPoseidon(msgHash, sig, publicKey);
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
