
import { utils } from "circomlibjs";
import { poseidon } from "circomlibjs";
import type { Scalar, F1Field } from "ffjavascript";

// We need to import the actual object for usage
import { Scalar as ScalarImpl, F1Field as F1FieldImpl } from "ffjavascript";

export interface BabyJubjubKeypair {
  privKey: bigint;
  pubKey: [bigint, bigint];
}

// Generate a random private key
const generateRandomPrivateKey = async (): Promise<bigint> => {
  // Generate a random 32-byte array
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  
  // Convert to a BigInt (we'll use the first 31 bytes to ensure it's less than the BabyJubJub field order)
  const F = new F1FieldImpl(utils.SNARK_FIELD_SIZE);
  const privKey = F.e(utils.leBuff2int(randomBytes.slice(0, 31)));
  
  return BigInt(privKey.toString());
};

// Derive public key from private key
const derivePublicKey = async (privateKey: bigint): Promise<[bigint, bigint]> => {
  const pubKey = await utils.privateKeyToPublicKey(privateKey);
  return pubKey;
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
  
  // Hash the message using Poseidon
  const msgHash = poseidon.F.e(ScalarImpl.e(utils.stringToBytes(message)));
  
  // Sign with private key
  const signature = await utils.signPoseidon(keypair.privKey, msgHash);
  
  // Convert signature to string format
  return `${signature.R8[0].toString()}:${signature.R8[1].toString()}:${signature.S.toString()}`;
};

// Verify a signature
export const verifySignature = async (
  message: string,
  signature: string,
  pubKey: [bigint, bigint]
): Promise<boolean> => {
  // Parse signature components
  const components = signature.split(':');
  if (components.length !== 3) {
    throw new Error('Invalid signature format');
  }
  
  const R8 = [BigInt(components[0]), BigInt(components[1])];
  const S = BigInt(components[2]);
  
  // Hash the message
  const msgHash = poseidon.F.e(ScalarImpl.e(utils.stringToBytes(message)));
  
  // Verify the signature
  return await utils.verifyPoseidon(msgHash, { R8, S }, pubKey);
};
