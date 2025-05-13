
import { buildBabyjub } from "circomlibjs";
import { StoredKeypair } from "@/types/keypair";

// Global variable to store the BabyJubjub instance once initialized
let babyJub: any = null;
let ORDER: bigint;

// Initialize BabyJubjub
async function getBabyJub(): Promise<any> {
  if (babyJub) return babyJub;
  
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto API unavailable; must run in a modern browser.");
  }
  
  babyJub = await buildBabyjub();
  ORDER = babyJub.subOrder;
  return babyJub;
}

// Convert a bigint to a big-endian byte array
function toBytesBE(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

// Convert a string to bytes
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// SHA-256 hash function
async function sha256(msg: Uint8Array): Promise<Uint8Array> {
  const h = await crypto.subtle.digest("SHA-256", msg);
  return new Uint8Array(h);
}

// Hash to scalar modulo order
async function hashToScalarBE(...parts: Uint8Array[]): Promise<bigint> {
  const all = Uint8Array.from(parts.flatMap(p => [...p]));
  const d = await sha256(all);
  const hex = [...d].map(b => b.toString(16).padStart(2, "0")).join("");
  const digestValue = BigInt("0x" + hex);
  return digestValue % ORDER;
}

// Generate a random scalar
function randomScalar(order: bigint): bigint {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt("0x" + hex) % order;
}

// Sign a message with the user's keypair
export async function signVote(
  keypair: StoredKeypair, 
  electionId: string, 
  choice: string
): Promise<{
  signature: string,
  publicKey: { x: string, y: string },
  timestamp: number
}> {
  const bj = await getBabyJub();
  const { F } = bj;
  
  // Convert keypair strings to bigints
  const privateKey = BigInt(keypair.k);
  const Ax = BigInt(keypair.Ax);
  const Ay = BigInt(keypair.Ay);
  
  // Create message from election ID and choice
  const timestamp = Date.now();
  const message = `${electionId}:${choice}:${timestamp}`;
  const msgBytes = stringToBytes(message);
  
  // Generate the internal nonce (r)
  const r = await hashToScalarBE(toBytesBE(privateKey), msgBytes);
  
  // Calculate R = r*B
  const R_e = bj.mulPointEscalar(bj.Base8, r);
  const Rx = F.toObject(R_e[0]);
  const Ry = F.toObject(R_e[1]);
  
  // Calculate challenge t = H(Rx || Ax || message)
  const t = await hashToScalarBE(
    toBytesBE(Rx),
    toBytesBE(Ax),
    msgBytes
  );
  
  // Calculate signature s = (r + privateKey * t) mod ORDER
  const s = (r + privateKey * t) % ORDER;
  
  // Format the signature as a JSON string for storage
  const signatureObject = {
    R: { x: Rx.toString(), y: Ry.toString() },
    s: s.toString(),
    message
  };
  
  return {
    signature: JSON.stringify(signatureObject),
    publicKey: { x: keypair.Ax, y: keypair.Ay },
    timestamp
  };
}

// Verify a signature
export async function verifySignature(
  signature: string,
  publicKey: { x: string, y: string }
): Promise<boolean> {
  try {
    const bj = await getBabyJub();
    const { F } = bj;
    
    // Parse the signature
    const sigObj = JSON.parse(signature);
    const s = BigInt(sigObj.s);
    const Rx = BigInt(sigObj.R.x);
    const Ry = BigInt(sigObj.R.y);
    const msgBytes = stringToBytes(sigObj.message);
    
    // Convert public key to bigints
    const Ax = BigInt(publicKey.x);
    const Ay = BigInt(publicKey.y);
    
    // Recreate points
    const R_e = [F.e(Rx), F.e(Ry)];
    const A_e = [F.e(Ax), F.e(Ay)];
    
    // Calculate challenge t = H(Rx || Ax || message)
    const t = await hashToScalarBE(
      toBytesBE(Rx),
      toBytesBE(Ax),
      msgBytes
    );
    
    // Verify: sB = R + tA
    const sB = bj.mulPointEscalar(bj.Base8, s);
    const tA = bj.mulPointEscalar(A_e, t);
    const rhs = bj.addPoint(R_e, tA);
    
    const sB_x = F.toObject(sB[0]);
    const sB_y = F.toObject(sB[1]);
    const rhs_x = F.toObject(rhs[0]);
    const rhs_y = F.toObject(rhs[1]);
    
    return sB_x === rhs_x && sB_y === rhs_y;
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}
