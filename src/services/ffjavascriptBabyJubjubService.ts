
import { buildBn128 } from 'ffjavascript';
import { ethers } from 'ethers';

export interface BabyJubjubKeyPair {
  privateKey: string; // Hex string representation of private key scalar
  publicKey: [string, string]; // [x, y] coordinates as hex strings
}

let bn128: any = null;
let babyJub: any = null;
const BABYJUBJUB_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617"); // Base field size

// Initialize the BN128 curve with Baby Jubjub
export const initBabyJubjub = async (): Promise<void> => {
  if (!bn128) {
    console.log("Initializing ffjavascript Baby Jubjub...");
    try {
      bn128 = await buildBn128();
      babyJub = bn128.Fr;
      console.log("ffjavascript Baby Jubjub initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ffjavascript Baby Jubjub:", error);
      throw error;
    }
  }
};

// Generate a new keypair 
export const generateKeypair = async (): Promise<BabyJubjubKeyPair> => {
  if (!bn128 || !babyJub) {
    await initBabyJubjub();
  }

  try {
    console.log("Generating private key...");
    
    // Generate random private key
    const randomHex = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const privateKeyBigInt = ethers.BigNumber.from(randomHex).mod(
      ethers.BigNumber.from(BABYJUBJUB_PRIME.toString())
    ).toBigInt();
    
    // Convert to Fr element
    const Fr = babyJub.e(privateKeyBigInt);
    console.log("Private key generated");
    
    // Get the base point (generator) of Baby Jubjub
    const basePoint = [
      bn128.F.e("17777552123799933955779906779655732241715742912184938656739573121738514868268"),
      bn128.F.e("2626589144620713026669568689430873010625803728049924121243784502389097019475")
    ];
    
    console.log("Computing public key point...");
    
    // Multiply base point by private key scalar to get public key
    const publicKeyPoint = bn128.Baby.mulPointEscalar(basePoint, Fr);
    
    // Convert points to hex strings
    const publicKeyX = publicKeyPoint[0].toString();
    const publicKeyY = publicKeyPoint[1].toString();
    
    console.log("Public key computed successfully");
    
    return {
      privateKey: privateKeyBigInt.toString(16), // Store as hex string
      publicKey: [publicKeyX, publicKeyY]
    };
  } catch (error) {
    console.error("Error generating Baby Jubjub keypair:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    throw error;
  }
};

// Store keypair in localStorage
export const storeKeypair = (keypair: BabyJubjubKeyPair): void => {
  try {
    localStorage.setItem('anonymous-keypair', JSON.stringify(keypair));
    console.log("Keypair stored in localStorage");
  } catch (error) {
    console.error("Error storing keypair:", error);
    throw error;
  }
};

// Retrieve keypair from localStorage
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

// Create Poseidon hash
export const poseidonHash = async (inputs: any[]): Promise<string> => {
  if (!bn128) {
    await initBabyJubjub();
  }
  
  try {
    // Convert inputs to field elements
    const fieldElements = inputs.map(input => 
      typeof input === 'string' ? babyJub.e(input) : babyJub.e(input.toString())
    );
    
    // Use the Poseidon hash function
    const hash = bn128.poseidon(fieldElements);
    
    return hash.toString();
  } catch (error) {
    console.error("Error creating Poseidon hash:", error);
    throw error;
  }
};

// Sign a message using the Poseidon hash function
export const signMessage = async (message: string, keypair: BabyJubjubKeyPair): Promise<string> => {
  if (!bn128 || !babyJub) {
    await initBabyJubjub();
  }

  try {
    // Convert message to bytes and hash with Poseidon
    const msgBytes = ethers.utils.toUtf8Bytes(message);
    const msgInts = Array.from(msgBytes).map(b => Number(b));
    const msgHash = await poseidonHash(msgInts);
    
    // Convert private key to field element
    const privateKey = babyJub.e('0x' + keypair.privateKey);
    
    // Generate random nonce (k)
    const randomHex = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const k = babyJub.e(ethers.BigNumber.from(randomHex).mod(
      ethers.BigNumber.from(BABYJUBJUB_PRIME.toString())
    ).toString());
    
    // Get base point
    const basePoint = [
      bn128.F.e("17777552123799933955779906779655732241715742912184938656739573121738514868268"),
      bn128.F.e("2626589144620713026669568689430873010625803728049924121243784502389097019475")
    ];
    
    // R = k·G
    const R = bn128.Baby.mulPointEscalar(basePoint, k);
    
    // h = Hash(R, public key, message)
    const publicKeyX = bn128.F.e(keypair.publicKey[0]);
    const publicKeyY = bn128.F.e(keypair.publicKey[1]);
    const h = await poseidonHash([R[0].toString(), R[1].toString(), publicKeyX.toString(), publicKeyY.toString(), msgHash]);
    
    // s = k - h·privateKey (mod r)
    const hFr = babyJub.e(h);
    const hTimesPrivateKey = babyJub.mul(hFr, privateKey);
    const s = babyJub.sub(k, hTimesPrivateKey);
    
    // Signature is (R, s)
    return JSON.stringify({
      R: [R[0].toString(), R[1].toString()],
      s: s.toString()
    });
  } catch (error) {
    console.error("Error signing message:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    throw error;
  }
};

// Verify a signature
export const verifySignature = async (
  message: string, 
  signatureStr: string, 
  publicKey: [string, string]
): Promise<boolean> => {
  if (!bn128 || !babyJub) {
    await initBabyJubjub();
  }

  try {
    // Parse signature
    const signature = JSON.parse(signatureStr);
    const R = [bn128.F.e(signature.R[0]), bn128.F.e(signature.R[1])];
    const s = babyJub.e(signature.s);
    
    // Convert message to bytes and hash with Poseidon
    const msgBytes = ethers.utils.toUtf8Bytes(message);
    const msgInts = Array.from(msgBytes).map(b => Number(b));
    const msgHash = await poseidonHash(msgInts);
    
    // Convert public key
    const publicKeyX = bn128.F.e(publicKey[0]);
    const publicKeyY = bn128.F.e(publicKey[1]);
    const pubKey = [publicKeyX, publicKeyY];
    
    // h = Hash(R, public key, message)
    const h = await poseidonHash([R[0].toString(), R[1].toString(), publicKeyX.toString(), publicKeyY.toString(), msgHash]);
    const hFr = babyJub.e(h);
    
    // Get base point
    const basePoint = [
      bn128.F.e("17777552123799933955779906779655732241715742912184938656739573121738514868268"),
      bn128.F.e("2626589144620713026669568689430873010625803728049924121243784502389097019475")
    ];
    
    // Calculate s·G
    const sG = bn128.Baby.mulPointEscalar(basePoint, s);
    
    // Calculate R + h·publicKey
    const hTimesPublicKey = bn128.Baby.mulPointEscalar(pubKey, hFr);
    const expectedR = bn128.Baby.addPoint(R, hTimesPublicKey);
    
    // Check if sG = R + h·publicKey
    return bn128.F.eq(sG[0], expectedR[0]) && bn128.F.eq(sG[1], expectedR[1]);
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
  if (!bn128 || !babyJub) {
    await initBabyJubjub();
  }
  
  try {
    // Create a unique string for this election and keypair
    const nullifierInput = `nullifier:${electionId}`;
    
    // Hash the nullifier input
    const nullifierBytes = ethers.utils.toUtf8Bytes(nullifierInput);
    const nullifierInts = Array.from(nullifierBytes).map(b => Number(b));
    const nullifierHash = await poseidonHash(nullifierInts);
    
    // Combine with private key
    const privateKey = babyJub.e('0x' + keypair.privateKey);
    const combinedScalar = babyJub.add(privateKey, babyJub.e(nullifierHash));
    
    // Get base point
    const basePoint = [
      bn128.F.e("17777552123799933955779906779655732241715742912184938656739573121738514868268"),
      bn128.F.e("2626589144620713026669568689430873010625803728049924121243784502389097019475")
    ];
    
    // Multiply base point by combined scalar
    const nullifierPoint = bn128.Baby.mulPointEscalar(basePoint, combinedScalar);
    
    // Use X coordinate as nullifier
    return nullifierPoint[0].toString();
  } catch (error) {
    console.error("Error generating nullifier:", error);
    throw error;
  }
};

// Get public key string representation
export const getPublicKeyString = (publicKey: [string, string]): string => {
  return JSON.stringify(publicKey);
};

// Parse public key from string
export const parsePublicKey = (publicKeyString: string): [string, string] => {
  return JSON.parse(publicKeyString) as [string, string];
};

// For compatibility with the original API that may be used in other components:
export const signWithKeypair = signMessage;
export const createKeypairFromWorldIDProof = async (worldIdProof: any): Promise<BabyJubjubKeyPair> => {
  // We're simplifying this in the new implementation to just generate a new keypair
  return generateKeypair();
};
