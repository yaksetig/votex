
import * as circomlibjs from "circomlibjs";
import { Scalar, F1Field } from "ffjavascript";

export interface BabyJubjubKeypair {
  privKey: bigint;
  pubKey: [bigint, bigint];
}

// We need to load the poseidon function asynchronously
let poseidon: any = null;
let babyJub: any = null;

// Initialize the circomlib functions
const initializeCircomlib = async () => {
  if (!poseidon) {
    poseidon = await circomlibjs.buildPoseidon();
  }
  if (!babyJub) {
    babyJub = await circomlibjs.buildBabyjub();
  }
};

// Generate a random private key
const generateRandomPrivateKey = async (): Promise<bigint> => {
  await initializeCircomlib();
  
  // Generate a random 32-byte array
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  
  // Convert to a BigInt (we'll use the first 31 bytes to ensure it's less than the BabyJubJub field order)
  const F = new F1Field(babyJub.p);
  const privKey = F.e(randomBytes.slice(0, 31));
  
  return BigInt(privKey.toString());
};

// Derive public key from private key
const derivePublicKey = async (privateKey: bigint): Promise<[bigint, bigint]> => {
  await initializeCircomlib();
  
  const pubKey = babyJub.mulPointEscalar(babyJub.Base8, privateKey.toString());
  return [BigInt(pubKey[0].toString()), BigInt(pubKey[1].toString())];
};

// Generate a new keypair
export const generateKeypair = async (): Promise<BabyJubjubKeypair> => {
  const privKey = await generateRandomPrivateKey();
  const pubKey = await derivePublicKey(privKey);
  
  return {
    privKey,
    pubKey,
  };
};

// Store keypair in localStorage
export const storeKeypair = (keypair: BabyJubjubKeypair): void => {
  localStorage.setItem('anonymous-keypair', JSON.stringify({
    privKey: keypair.privKey.toString(),
    pubKey: [keypair.pubKey[0].toString(), keypair.pubKey[1].toString()],
  }));
};

// Retrieve keypair from localStorage
export const retrieveKeypair = (): BabyJubjubKeypair | null => {
  const storedKeypair = localStorage.getItem('anonymous-keypair');
  
  if (!storedKeypair) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(storedKeypair);
    return {
      privKey: BigInt(parsed.privKey),
      pubKey: [BigInt(parsed.pubKey[0]), BigInt(parsed.pubKey[1])],
    };
  } catch (error) {
    console.error('Error parsing stored keypair:', error);
    return null;
  }
};

// Sign a message with a keypair
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeypair): Promise<string> => {
  if (!keypair) {
    throw new Error('No keypair provided for signing');
  }
  
  await initializeCircomlib();
  
  // Hash the message using Poseidon
  const messageBytes = new TextEncoder().encode(message);
  const msgHash = poseidon(messageBytes);
  
  // Sign with private key (simplified implementation)
  const signature = babyJub.signPoseidon(keypair.privKey.toString(), msgHash);
  
  // Convert signature to string format
  return `${signature.R8[0].toString()}:${signature.R8[1].toString()}:${signature.S.toString()}`;
};

// Verify a signature
export const verifySignature = async (
  message: string,
  signature: string,
  pubKey: [bigint, bigint]
): Promise<boolean> => {
  await initializeCircomlib();
  
  // Parse signature components
  const components = signature.split(':');
  if (components.length !== 3) {
    throw new Error('Invalid signature format');
  }
  
  const R8 = [components[0], components[1]];
  const S = components[2];
  
  // Hash the message
  const messageBytes = new TextEncoder().encode(message);
  const msgHash = poseidon(messageBytes);
  
  // Verify the signature
  return babyJub.verifyPoseidon(msgHash, { R8, S }, [pubKey[0].toString(), pubKey[1].toString()]);
};
