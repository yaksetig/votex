
import circomlibjs from 'circomlibjs'

export interface BabyJubjubKeypair {
  pubKey: string[];
  privKey: string;
}

export interface BabyJubjubSignature {
  R8: string[];
  S: string;
}

export const KEYPAIR_STORAGE_KEY = 'votex_baby_jubjub_keypair'

// Lazy-loaded circomlibjs instance
let circomlib: any = null;
let babyJub: any = null;
let poseidon: any = null;

const initLibraries = async () => {
  if (!circomlib) {
    // Using dynamic import to avoid the default export issue
    circomlib = await import('circomlibjs');
    babyJub = await circomlib.buildBabyjub();
    poseidon = await circomlib.buildPoseidon();
  }
  return { babyJub, poseidon };
}

/**
 * Generate a new random Baby Jubjub keypair
 */
export const generateKeypair = async (): Promise<BabyJubjubKeypair> => {
  const { babyJub } = await initLibraries();
  
  // Generate random private key (32 bytes)
  const privKeyBytes = new Uint8Array(32);
  window.crypto.getRandomValues(privKeyBytes);
  
  // Make sure the private key is in the field
  const privKey = babyJub.F.e(Buffer.from(privKeyBytes).toString('hex'));
  
  // Derive public key (point on the curve)
  const pubKey = babyJub.mulPointEscalar(babyJub.Base8, privKey);
  
  const keypair = {
    pubKey: [pubKey[0].toString(), pubKey[1].toString()],
    privKey: privKey.toString()
  };
  
  return keypair;
}

/**
 * Store keypair in local storage
 */
export const storeKeypair = (keypair: BabyJubjubKeypair): void => {
  localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(keypair));
}

/**
 * Retrieve keypair from local storage
 */
export const retrieveKeypair = (): BabyJubjubKeypair | null => {
  const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
}

/**
 * Sign a message using the Baby Jubjub keypair
 */
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeypair): Promise<string> => {
  const { babyJub, poseidon } = await initLibraries();
  
  // Create poseidon hash of the message
  const msgHash = poseidon.F.e(poseidon([message]));
  
  // Convert private key to the right format
  const privKey = babyJub.F.e(keypair.privKey);
  
  // Sign the message
  const signature = babyJub.signPoseidon(privKey, msgHash);
  
  // Convert signature to serializable format
  const formattedSignature: BabyJubjubSignature = {
    R8: [signature.R8[0].toString(), signature.R8[1].toString()],
    S: signature.S.toString()
  };
  
  return JSON.stringify(formattedSignature);
}

/**
 * Verify a Baby Jubjub signature
 */
export const verifySignature = async (
  message: string, 
  signature: string, 
  pubKey: string[]
): Promise<boolean> => {
  const { babyJub, poseidon } = await initLibraries();
  
  // Parse the signature
  const parsedSignature = JSON.parse(signature) as BabyJubjubSignature;
  
  // Create poseidon hash of the message
  const msgHash = poseidon.F.e(poseidon([message]));
  
  // Convert signature and public key to the right format
  const formattedPubKey = [babyJub.F.e(pubKey[0]), babyJub.F.e(pubKey[1])];
  const formattedSignature = {
    R8: [babyJub.F.e(parsedSignature.R8[0]), babyJub.F.e(parsedSignature.R8[1])],
    S: babyJub.F.e(parsedSignature.S)
  };
  
  // Verify the signature
  return babyJub.verifyPoseidon(msgHash, formattedSignature, formattedPubKey);
}
