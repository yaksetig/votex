// src/services/fixedBabyJubjubService.ts
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

// Global instance - make sure it's initialized only once
let babyJub: any = null;
let ORDER: bigint;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

// Initialize Baby Jubjub library (asynchronous)
export const initBabyJubjub = async (): Promise<void> => {
  // If already initialized, return immediately
  if (babyJub !== null) {
    console.log("Baby Jubjub already initialized");
    return;
  }
  
  // If currently initializing, wait for that process to complete
  if (isInitializing && initPromise) {
    console.log("Baby Jubjub initialization in progress, waiting...");
    return initPromise;
  }
  
  // Start initialization
  console.log("Initializing Baby Jubjub (circomlibjs)...");
  isInitializing = true;
  
  initPromise = new Promise<void>(async (resolve, reject) => {
    try {
      // Build the BabyJubjub instance
      babyJub = await buildBabyjub();
      
      // Explicitly verify that F.e exists before proceeding
      if (!babyJub.F || typeof babyJub.F.e !== 'function') {
        throw new Error("BabyJubjub initialization incomplete: F.e is not a function");
      }
      
      ORDER = babyJub.subOrder;
      console.log("Baby Jubjub initialized successfully with order:", ORDER.toString());
      isInitializing = false;
      resolve();
    } catch (error) {
      console.error("Failed to initialize Baby Jubjub:", error);
      isInitializing = false;
      babyJub = null; // Reset so we can try again
      reject(error);
    }
  });
  
  return initPromise;
};

// Generate a keypair from scratch with careful error handling
export const generateKeypair = async (): Promise<BabyJubjubKeyPair> => {
  // Ensure BabyJubjub is initialized
  await initBabyJubjub();
  
  // Double-check that it's properly initialized
  if (!babyJub || !babyJub.F || typeof babyJub.F.e !== 'function') {
    console.error("BabyJubjub not properly initialized before generating keypair");
    throw new Error("BabyJubjub not properly initialized");
  }

  try {
    console.log("Generating private key...");
    
    // Generate random private key using crypto.getRandomValues
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const privateKeyHex = [...randomBytes].map(b => b.toString(16).padStart(2,"0")).join("");
    const privateKeyBigInt = BigInt("0x" + privateKeyHex) % ORDER;
    console.log("Private key generated:", privateKeyBigInt.toString().substring(0, 10) + "...");
    
    // Convert to bytes for storage
    const privateKeyBytes = ethers.utils.arrayify(
      ethers.BigNumber.from(privateKeyBigInt.toString()).toHexString()
    );
    
    // Derive public key with careful error handling
    console.log("Deriving public key...");
    if (!babyJub.Base8 || !babyJub.mulPointEscalar) {
      throw new Error("BabyJubjub missing required methods");
    }
    
    const A_e = babyJub.mulPointEscalar(babyJub.Base8, privateKeyBigInt);
    console.log("Public key point generated");
    
    // Check if the point is valid
    if (!A_e || !Array.isArray(A_e) || A_e.length !== 2) {
      throw new Error("Invalid public key point generated");
    }
    
    // Convert points to bytes with careful error handling
    if (!babyJub.F.toObject) {
      throw new Error("BabyJubjub F.toObject method missing");
    }
    
    const publicKeyX = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(A_e[0])).toHexString()
    );
    
    const publicKeyY = ethers.utils.arrayify(
      ethers.BigNumber.from(babyJub.F.toObject(A_e[1])).toHexString()
    );
    
    console.log("Keypair generated successfully");
    
    return {
      privateKey: privateKeyBytes,
      publicKey: [publicKeyX, publicKeyY]
    };
  } catch (error) {
    console.error("Error generating Baby Jubjub keypair:", error);
    // Log the current state of babyJub for debugging
    console.error("Current babyJub state:", {
      isNull: babyJub === null,
      hasF: babyJub && !!babyJub.F,
      hasFE: babyJub && babyJub.F && typeof babyJub.F.e === 'function',
      hasBase8: babyJub && !!babyJub.Base8,
      hasMulPointEscalar: babyJub && typeof babyJub.mulPointEscalar === 'function'
    });
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
    // Parse the signature
    const signature = JSON.parse(signatureStr);
    const R = [BigInt(signature.R[0]), BigInt(signature.R[1])].map(s => babyJub.F.e(s));
    const s = BigInt(signature.s);
    
    // Message bytes
    const msgBytes = ethers.utils.toUtf8Bytes(message);
    
    // Convert public key points to BigInt
    const publicKeyX = ethers.BigNumber.from('0x' + Buffer.from(publicKey[0]).toString('hex')).toBigInt();
    const publicKeyY = ethers.BigNumber.from('0x' + Buffer.from(publicKey[1]).toString('hex')).toBigInt();
    
    // Step 1: Calculate t = H(Rx || Ax || msg) mod order
    const Rx = BigInt(signature.R[0]);
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
