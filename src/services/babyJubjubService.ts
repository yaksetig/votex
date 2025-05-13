
import type { BabyJub } from "circomlibjs";
import { buildBabyjub } from "circomlibjs";
import { ethers } from "ethers";

// The BabyJubjub keypair interface
export interface BabyJubjubKeyPair {
  privateKey: Uint8Array;
  publicKey: [Uint8Array, Uint8Array]; // [x, y] coordinates
}

// Global instance of BabyJub
let babyJub: BabyJub | null = null;
let ORDER: bigint;

// Initialize BabyJub
export async function initBabyJubjub(): Promise<BabyJub> {
  if (babyJub) return babyJub;
  
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto API unavailable; must run in a modern browser.");
  }
  
  babyJub = await buildBabyjub();
  console.log("🐣 circomlibjs babyJub ready:", babyJub);
  ORDER = babyJub.subOrder;
  return babyJub;
}

// Generate a random scalar for key generation
function randomScalar(order: bigint): bigint {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt("0x" + hex) % order;
}

// Generate a keypair in the circomlibjs format
export async function generateRawKeypair(): Promise<{
  k: bigint;
  Ax: bigint;
  Ay: bigint;
}> {
  const bj = await initBabyJubjub();
  const { F, Base8: B, subOrder } = bj;
  const k = randomScalar(subOrder);
  const A_e = bj.mulPointEscalar(B, k);
  const Ax = F.toObject(A_e[0]);
  const Ay = F.toObject(A_e[1]);
  return { k, Ax, Ay };
}

// Generate a keypair in the format used by the application
export async function generateKeypair(): Promise<BabyJubjubKeyPair> {
  const { k, Ax, Ay } = await generateRawKeypair();
  
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

// Create a keypair from a seed
export async function createKeypairFromSeed(seed: string): Promise<BabyJubjubKeyPair> {
  // Initialize BabyJub
  const bj = await initBabyJubjub();
  const { F, Base8 } = bj;
  
  // Create a deterministic private key from the seed
  const encoder = new TextEncoder();
  const seedData = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', seedData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Convert to bigint and ensure it's within the suborder
  const privateKeyBigInt = BigInt('0x' + hashHex) % ORDER;
  
  // Generate public key
  const publicPoint = bj.mulPointEscalar(Base8, privateKeyBigInt);
  const publicX = F.toObject(publicPoint[0]);
  const publicY = F.toObject(publicPoint[1]);
  
  // Convert to expected format
  const privateKeyBytes = ethers.utils.arrayify(
    ethers.BigNumber.from(privateKeyBigInt.toString()).toHexString().padStart(66, '0x0')
  );
  
  const publicKeyX = ethers.utils.arrayify(
    ethers.BigNumber.from(publicX.toString()).toHexString().padStart(66, '0x0')
  );
  
  const publicKeyY = ethers.utils.arrayify(
    ethers.BigNumber.from(publicY.toString()).toHexString().padStart(66, '0x0')
  );
  
  return {
    privateKey: privateKeyBytes,
    publicKey: [publicKeyX, publicKeyY]
  };
}

// Get public key as a string
export function getPublicKeyString(publicKey: [Uint8Array, Uint8Array]): string {
  return JSON.stringify([
    Buffer.from(publicKey[0]).toString('hex'),
    Buffer.from(publicKey[1]).toString('hex')
  ]);
}

// Sign a message with a keypair
export async function signWithKeypair(message: string, keypair: BabyJubjubKeyPair): Promise<string> {
  // Initialize BabyJub
  const bj = await initBabyJubjub();
  
  // Convert message to a format compatible with Poseidon hash
  const msgBytes = ethers.utils.toUtf8Bytes(message);
  const fieldElements = Array.from(msgBytes).map(b => bj.F.e(b));
  const msgHash = bj.F.e(bj.poseidon(fieldElements));
  
  // Convert private key to BigInt
  const privateKeyBigInt = ethers.BigNumber.from(
    '0x' + Buffer.from(keypair.privateKey).toString('hex')
  ).toBigInt();
  
  // Sign the hash with private key
  const signature = bj.signPoseidon(privateKeyBigInt, msgHash);
  
  // Return signature as JSON string
  return JSON.stringify({
    R8: [signature.R8[0].toString(), signature.R8[1].toString()],
    S: signature.S.toString()
  });
}

// Verify a signature
export async function verifySignature(
  message: string, 
  signatureStr: string, 
  publicKey: [Uint8Array, Uint8Array]
): Promise<boolean> {
  // Initialize BabyJub
  const bj = await initBabyJubjub();
  
  // Parse the signature
  const signature = JSON.parse(signatureStr);
  
  // Convert message to a format compatible with Poseidon hash
  const msgBytes = ethers.utils.toUtf8Bytes(message);
  const fieldElements = Array.from(msgBytes).map(b => bj.F.e(b));
  const msgHash = bj.F.e(bj.poseidon(fieldElements));
  
  // Convert signature components
  const R8 = [bj.F.e(signature.R8[0]), bj.F.e(signature.R8[1])];
  const S = bj.F.e(signature.S);
  
  // Convert public key to the format expected by BabyJub
  const pubKeyX = ethers.BigNumber.from('0x' + Buffer.from(publicKey[0]).toString('hex')).toBigInt();
  const pubKeyY = ethers.BigNumber.from('0x' + Buffer.from(publicKey[1]).toString('hex')).toBigInt();
  const pubKey = [bj.F.e(pubKeyX), bj.F.e(pubKeyY)];
  
  // Verify the signature
  return bj.verifyPoseidon(msgHash, { R8, S }, pubKey);
}

// Store keypair in localStorage
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

// Retrieve keypair from localStorage
export async function retrieveKeypair(): Promise<BabyJubjubKeyPair | null> {
  try {
    const stored = localStorage.getItem('anonymous-keypair');
    if (!stored) return null;
    
    const serialized = JSON.parse(stored);
    
    return {
      privateKey: Buffer.from(serialized.privateKey, 'hex'),
      publicKey: [
        Buffer.from(serialized.publicKeyX, 'hex'),
        Buffer.from(serialized.publicKeyY, 'hex')
      ]
    };
  } catch (error) {
    console.error("Error retrieving keypair:", error);
    return null;
  }
}

// Generate a nullifier to prevent double-voting
export async function generateNullifier(
  electionId: string,
  keypair: BabyJubjubKeyPair
): Promise<string> {
  const bj = await initBabyJubjub();
  
  // Create a unique string for this election and keypair
  const nullifierInput = `nullifier:${electionId}`;
  
  // Hash it with Poseidon
  const msgBytes = ethers.utils.toUtf8Bytes(nullifierInput);
  const fieldElements = Array.from(msgBytes).map(b => bj.F.e(b));
  const nullifierHash = bj.F.e(bj.poseidon(fieldElements));
  
  // Convert private key to the format expected by Baby Jubjub
  const privateKeyBigInt = ethers.BigNumber.from(
    '0x' + Buffer.from(keypair.privateKey).toString('hex')
  ).toBigInt();
  const privateKeyFr = bj.F.e(privateKeyBigInt);
  
  // Create a unique point that only this user with this keypair can generate
  const nullifierPoint = bj.mulPointEscalar(
    bj.Base8,
    bj.F.add(privateKeyFr, nullifierHash)
  );
  
  // Return the X coordinate as the nullifier
  return ethers.BigNumber.from(
    bj.F.toObject(nullifierPoint[0])
  ).toHexString();
}
