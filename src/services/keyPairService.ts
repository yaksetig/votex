
// We'll use ffjavascript which has better ESM support than circomlibjs
import { Scalar, F1Field, utils } from 'ffjavascript';

// Constants for Baby Jubjub
// Prime field size for bn128
const Q = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const SUBORDER = Scalar.fromString("2736030358979909402780800718157159386076813972158567259200215660948447373041");
const A = Scalar.fromString("168700");
const D = Scalar.fromString("168696");

const F = new F1Field(Q);

// Baby Jubjub Point
interface Point {
  x: bigint;
  y: bigint;
}

// Empty or zero point representation
const ZERO = { x: 0n, y: 1n };

// Base point (generator)
const BASE8 = {
  x: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  y: 16950150798460657717958625567821834550301663161624707787222815936182638968203n
};

export interface BabyJubjubKeypair {
  pubKey: string[];  // [x, y] coordinates of public key
  privKey: string;   // Private key
}

export interface BabyJubjubSignature {
  R8: string[];      // [x, y] coordinates of R point
  S: string;         // S value
}

export const KEYPAIR_STORAGE_KEY = 'votex_baby_jubjub_keypair';

/**
 * Point addition on Baby Jubjub curve: P + Q
 */
function pointAdd(P: Point, Q: Point): Point {
  // Handle special cases
  if (P.x === 0n && P.y === 1n) return Q;
  if (Q.x === 0n && Q.y === 1n) return P;

  // x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2)
  // y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2)

  const x1 = P.x;
  const y1 = P.y;
  const x2 = Q.x;
  const y2 = Q.y;

  // Calculate intermediate values
  const x1y2 = F.mul(x1, y2);
  const y1x2 = F.mul(y1, x2);
  const x1x2 = F.mul(x1, x2);
  const y1y2 = F.mul(y1, y2);
  const dx1x2y1y2 = F.mul(F.mul(F.mul(D, x1), x2), F.mul(y1, y2));

  // Calculate numerators and denominators
  const x3Num = F.add(x1y2, y1x2);
  const x3Den = F.add(1n, dx1x2y1y2);
  const y3Num = F.sub(y1y2, F.mul(A, x1x2));
  const y3Den = F.sub(1n, dx1x2y1y2);

  // Calculate x3 and y3
  const x3 = F.div(x3Num, x3Den);
  const y3 = F.div(y3Num, y3Den);

  return { x: x3, y: y3 };
}

/**
 * Scalar multiplication on Baby Jubjub curve: k*P
 */
function pointMul(k: bigint, P: Point): Point {
  // Scalar multiplication using double-and-add algorithm
  let result = ZERO;
  let current = P;
  let scalar = k;

  while (scalar > 0n) {
    if (scalar & 1n) {
      result = pointAdd(result, current);
    }
    current = pointAdd(current, current); // double
    scalar >>= 1n;
  }
  
  return result;
}

/**
 * Generate a random scalar suitable for Baby Jubjub
 */
async function randomScalar(): Promise<bigint> {
  // Generate 32 random bytes
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  
  // Convert to bigint and ensure it's in the valid range
  const scalar = utils.leBuff2int(randomBytes) % SUBORDER;
  return scalar;
}

/**
 * Hash a message to a field element in Baby Jubjub's field
 */
async function hashToField(message: string): Promise<bigint> {
  const msgBuff = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', msgBuff);
  const hashBuff = new Uint8Array(hash);
  
  // Convert hash to field element
  const hashBigInt = utils.leBuff2int(hashBuff);
  return F.e(hashBigInt);
}

/**
 * Generate a Baby Jubjub keypair
 */
export const generateKeypair = async (): Promise<BabyJubjubKeypair> => {
  // Generate random private key
  const privKey = await randomScalar();
  
  // Compute public key = privKey * BASE8
  const pubKey = pointMul(privKey, BASE8);
  
  return {
    pubKey: [pubKey.x.toString(), pubKey.y.toString()],
    privKey: privKey.toString()
  };
};

/**
 * Store keypair in local storage
 */
export const storeKeypair = (keypair: BabyJubjubKeypair): void => {
  localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(keypair));
};

/**
 * Retrieve keypair from local storage
 */
export const retrieveKeypair = (): BabyJubjubKeypair | null => {
  const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
};

/**
 * Sign a message using Baby Jubjub (Schnorr signature)
 */
export const signWithKeypair = async (message: string, keypair: BabyJubjubKeypair): Promise<string> => {
  // Parse keypair
  const privKey = BigInt(keypair.privKey);
  
  // Hash the message
  const msgHash = await hashToField(message);
  
  // Generate a random nonce
  const k = await randomScalar();
  
  // Compute R = k * BASE8
  const R = pointMul(k, BASE8);
  
  // Compute h = H(R || pubKey || msg)
  const pubKeyX = BigInt(keypair.pubKey[0]);
  const pubKeyY = BigInt(keypair.pubKey[1]);
  const hashInput = `${R.x},${R.y},${pubKeyX},${pubKeyY},${message}`;
  const h = await hashToField(hashInput);
  
  // Compute S = k + h*privKey mod SUBORDER
  const S = F.e((k + F.mul(h, privKey)) % SUBORDER);
  
  const signature: BabyJubjubSignature = {
    R8: [R.x.toString(), R.y.toString()],
    S: S.toString()
  };
  
  return JSON.stringify(signature);
};

/**
 * Verify a Baby Jubjub signature (Schnorr verification)
 */
export const verifySignature = async (
  message: string, 
  signatureJson: string, 
  pubKeyArr: string[]
): Promise<boolean> => {
  try {
    // Parse inputs
    const signature = JSON.parse(signatureJson) as BabyJubjubSignature;
    const R = { 
      x: BigInt(signature.R8[0]), 
      y: BigInt(signature.R8[1]) 
    };
    const S = BigInt(signature.S);
    const pubKey = { 
      x: BigInt(pubKeyArr[0]), 
      y: BigInt(pubKeyArr[1])
    };
    
    // Compute h = H(R || pubKey || msg)
    const hashInput = `${R.x},${R.y},${pubKey.x},${pubKey.y},${message}`;
    const h = await hashToField(hashInput);
    
    // Verify S*G = R + h*pubKey
    const sG = pointMul(S, BASE8);
    const hP = pointMul(h, pubKey);
    const R_plus_hP = pointAdd(R, hP);
    
    // Check if the points are equal
    return sG.x === R_plus_hP.x && sG.y === R_plus_hP.y;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
};
