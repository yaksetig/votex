import { buildBabyjub } from 'circomlibjs';
import { ethers } from 'ethers';

// Global instance of BabyJubjub
let babyJub: any = null;
let ORDER: bigint;

export interface BabyJubjubKeyPair {
  privateKey: Uint8Array;
  publicKey: [Uint8Array, Uint8Array]; // [x, y] coordinates
}

export interface SerializedBabyJubjubKeyPair {
  privateKey: string;
  publicKeyX: string;
  publicKeyY: string;
}

// Initialize Baby Jubjub library (asynchronous)
export const initBabyJubjub = async (): Promise<void> => {
  try {
    if (babyJub !== null) {
      console.log("Baby Jubjub already initialized");
      return;
    }
    
    console.log("Initializing Baby Jubjub (circomlibjs)...");
    babyJub = await buildBabyjub();
    ORDER = babyJub.subOrder;
    console.log("Baby Jubjub initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Baby Jubjub:", error);
    throw error;
  }
};

// Helper functions for byte conversion
function toHex(x: bigint): string {
  return "0x" + x.toString(16);
}

function toBytesBE(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

// SHA-256 helper
async function sha256(msg: Uint8Array): Promise<Uint8Array> {
  const h = await crypto.subtle.digest("SHA-256", msg);
  return new Uint8Array(h);
}

// Hash → scalar mod order, over big-endian parts
async function hashToScalarBE(...parts: Uint8Array[]): Promise<bigint> {
  const all = Uint8Array.from(parts.flatMap(p => [...p]));
  const d = await sha256(all);
  const hex = [...d].map(b => b.toString(16).padStart(2,"0")).join("");
  const digestValue = BigInt("0x" + hex);
  return digestValue % ORDER;
}

// Generate a keypair from scratch
export const generateKeypair = async (): Promise<BabyJubjubKeyPair> => {
  if (!babyJub) {
    await initBabyJubjub();
  }

  try {
    // Generate random private key
    const k = randomScalar();
    
    // Convert to bytes for storage
    const privateKeyBytes = ethers.utils.arrayify(
      ethers.BigNumber.from(k.toString()).toHexString().padStart(66, '0x0')
    );
    
    // Derive public key
    const A_e = babyJub.mulPointEscalar(babyJub.Base8, k);
    
    // Convert points to bytes
    const publicKeyX = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(A_e[0])).toHexString().padStart(66, '0x0')
    );
    
    const publicKeyY = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(A_e[1])).toHexString().padStart(66, '0x0')
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

// Create a keypair from a seed (useful for WorldID integration)
export const createKeypairFromSeed = async (seed: string): Promise<BabyJubjubKeyPair> => {
  if (!babyJub) {
    await initBabyJubjub();
  }
  
  try {
    // Hash the seed to get a deterministic private key
    const seedBytes = ethers.utils.toUtf8Bytes(seed);
    const seedHash = ethers.utils.keccak256(seedBytes);
    
    // Use the hash as private key seed
    const privateKeyBytes = ethers.utils.arrayify(seedHash);
    const privateKeyBigInt = ethers.BigNumber.from(seedHash).mod(
      ethers.BigNumber.from(ORDER.toString())
    ).toBigInt();
    
    // Derive public key
    const A_e = babyJub.mulPointEscalar(babyJub.Base8, privateKeyBigInt);
    
    // Convert points to bytes
    const publicKeyX = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(A_e[0])).toHexString().padStart(66, '0x0')
    );
    
    const publicKeyY = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(A_e[1])).toHexString().padStart(66, '0x0')
    );
    
    return {
      privateKey: privateKeyBytes,
      publicKey: [publicKeyX, publicKeyY]
    };
  } catch (error) {
    console.error("Error creating keypair from seed:", error);
    throw error;
  }
};

// Sign a message using the Baby Jubjub keypair
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeyPair): Promise<string> => {
  if (!babyJub) {
    await initBabyJubjub();
  }

  try {
    // Convert private key to bigint
    const privateKeyBigInt = ethers.BigNumber.from('0x' + Buffer.from(keypair.privateKey).toString('hex')).toBigInt();
    
    // Message bytes
    const msgBytes = ethers.utils.toUtf8Bytes(message);
    
    // Step 1: Generate r = H(k || msg) mod order
    const r = await hashToScalarBE(toBytesBE(privateKeyBigInt), msgBytes);
    
    // Step 2: Calculate R = r·B
    const R_e = babyJub.mulPointEscalar(babyJub.Base8, r);
    const Rx = babyJub.F.toObject(R_e[0]);
    const Ry = babyJub.F.toObject(R_e[1]);
    
    // Step 3: Calculate t = H(Rx || Ax || msg) mod order
    const Ax = babyJub.F.toObject(babyJub.mulPointEscalar(babyJub.Base8, privateKeyBigInt)[0]);
    const t = await hashToScalarBE(toBytesBE(Rx), toBytesBE(Ax), msgBytes);
    
    // Step 4: Calculate s = (r + k·t) mod order
    const s = (r + privateKeyBigInt * t) % ORDER;
    
    // Return the signature
    return JSON.stringify({
      R: [Rx.toString(), Ry.toString()],
      s: s.toString()
    });
  } catch (error) {
    console.error("Error signing message:", error);
    throw error;
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
    const nullifierBytes = ethers.utils.toUtf8Bytes(nullifierInput);
    
    // Convert private key to bigint
    const privateKeyBigInt = ethers.BigNumber.from('0x' + Buffer.from(keypair.privateKey).toString('hex')).toBigInt();
    
    // Hash the input with the private key
    const nullifierHash = await hashToScalarBE(toBytesBE(privateKeyBigInt), nullifierBytes);
    
    // Create a unique point from the hash
    const nullifierPoint = babyJub.mulPointEscalar(
      babyJub.Base8, 
      nullifierHash
    );
    
    // Return the X coordinate as the nullifier
    return babyJub.F.toObject(nullifierPoint[0]).toString();
  } catch (error) {
    console.error("Error generating nullifier:", error);
    throw error;
  }
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

// Get public key as string
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

// Verify a signature - exported so components can use it directly
export const verifySignature = async (
  message: string,
  signatureStr: string,
  publicKey: [Uint8Array, Uint8Array]
): Promise<boolean> => {
  if (!babyJub) {
    await initBabyJubjub();
  }

  try {
    // Parse the signature
    const signature = JSON.parse(signatureStr);
    const R = [signature.R[0], signature.R[1]].map(s => BigInt(s));
    const s = BigInt(signature.s);
    
    // Message bytes
    const msgBytes = ethers.utils.toUtf8Bytes(message);
    
    // Convert public key points to BigInt
    const publicKeyX = ethers.BigNumber.from('0x' + Buffer.from(publicKey[0]).toString('hex')).toBigInt();
    const publicKeyY = ethers.BigNumber.from('0x' + Buffer.from(publicKey[1]).toString('hex')).toBigInt();
    
    // Step 1: Calculate t = H(Rx || Ax || msg) mod order
    const Rx = R[0];
    const Ax = publicKeyX;
    const t = await hashToScalarBE(toBytesBE(Rx), toBytesBE(Ax), msgBytes);
    
    // Step 2: Calculate s·B
    const sB = babyJub.mulPointEscalar(babyJub.Base8, s);
    
    // Step 3: Calculate R + t·A
    const publicKeyPoint = [
      babyJub.F.e(publicKeyX),
      babyJub.F.e(publicKeyY)
    ];
    const tA = babyJub.mulPointEscalar(publicKeyPoint, t);
    const R_e = [babyJub.F.e(R[0]), babyJub.F.e(R[1])];
    const rhs = babyJub.addPoint(R_e, tA);
    
    // Step 4: Check if s·B = R + t·A
    const lhsX = babyJub.F.toObject(sB[0]);
    const lhsY = babyJub.F.toObject(sB[1]);
    const rhsX = babyJub.F.toObject(rhs[0]);
    const rhsY = babyJub.F.toObject(rhs[1]);
    
    return lhsX === rhsX && lhsY === rhsY;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
};

// Helper function to generate a random scalar
function randomScalar(): bigint {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  const hex = [...buf].map(b=>b.toString(16).padStart(2,"0")).join("");
  return BigInt("0x" + hex) % ORDER;
}
