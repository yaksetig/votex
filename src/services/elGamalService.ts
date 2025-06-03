import { StoredKeypair } from "@/types/keypair";

// BabyJubJub curve parameters
const CURVE_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const D = 168696n;
const A = 168700n;

// Base point coordinates
const BASE_POINT = {
  x: 16540640123574156134436876038791482806971768689494387082833631921987005038935n,
  y: 20819045374670962167435360035096875258406992893633759881276124905556507972311n
};

// Utility functions
function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

function modInverse(a: bigint, m: bigint): bigint | null {
  if (a < 0n) a = mod(a, m);
  
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  
  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }
  
  return old_r > 1n ? null : mod(old_s, m);
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

async function sha256(msg: Uint8Array): Promise<Uint8Array> {
  const h = await crypto.subtle.digest("SHA-256", msg);
  return new Uint8Array(h);
}

async function hashToScalarBE(...parts: Uint8Array[]): Promise<bigint> {
  const all = Uint8Array.from(parts.flatMap(p => [...p]));
  const d = await sha256(all);
  const hex = [...d].map(b => b.toString(16).padStart(2, "0")).join("");
  return BigInt("0x" + hex) % CURVE_ORDER;
}

// Edwards curve point operations for BabyJubJub
class EdwardsPoint {
  x: bigint;
  y: bigint;

  constructor(x: bigint, y: bigint) {
    this.x = mod(x, FIELD_SIZE);
    this.y = mod(y, FIELD_SIZE);
  }

  static identity(): EdwardsPoint {
    return new EdwardsPoint(0n, 1n);
  }

  static base(): EdwardsPoint {
    return new EdwardsPoint(BASE_POINT.x, BASE_POINT.y);
  }

  isOnCurve(): boolean {
    const x2 = (this.x * this.x) % FIELD_SIZE;
    const y2 = (this.y * this.y) % FIELD_SIZE;
    const left = (A * x2 + y2) % FIELD_SIZE;
    const right = (1n + D * x2 * y2) % FIELD_SIZE;
    return left === right;
  }

  add(other: EdwardsPoint): EdwardsPoint {
    const x1 = this.x, y1 = this.y;
    const x2 = other.x, y2 = other.y;
    
    const x1y2 = (x1 * y2) % FIELD_SIZE;
    const y1x2 = (y1 * x2) % FIELD_SIZE;
    const y1y2 = (y1 * y2) % FIELD_SIZE;
    const x1x2 = (x1 * x2) % FIELD_SIZE;
    
    const dx1x2y1y2 = (D * x1x2 * y1y2) % FIELD_SIZE;
    
    const x3_num = (x1y2 + y1x2) % FIELD_SIZE;
    const x3_den = modInverse((1n + dx1x2y1y2) % FIELD_SIZE, FIELD_SIZE);
    
    const y3_num = (y1y2 - A * x1x2) % FIELD_SIZE;
    const y3_den = modInverse((1n - dx1x2y1y2 + FIELD_SIZE) % FIELD_SIZE, FIELD_SIZE);
    
    if (x3_den === null || y3_den === null) {
      throw new Error("Point addition failed - inverse doesn't exist");
    }
    
    const x3 = (x3_num * x3_den) % FIELD_SIZE;
    const y3 = (y3_num * y3_den) % FIELD_SIZE;
    
    return new EdwardsPoint(x3, y3);
  }

  multiply(scalar: bigint): EdwardsPoint {
    let result = EdwardsPoint.identity();
    let addend = new EdwardsPoint(this.x, this.y);
    let k = scalar;
    
    while (k > 0n) {
      if (k & 1n) {
        result = result.add(addend);
      }
      addend = addend.add(addend);
      k >>= 1n;
    }
    
    return result;
  }

  toString(): string {
    return `(${this.x.toString()}, ${this.y.toString()})`;
  }

  equals(other: EdwardsPoint): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

export interface ElGamalCiphertext {
  c1: EdwardsPoint;
  c2: EdwardsPoint;
  r: bigint;
  ciphertext: [bigint, bigint, bigint, bigint];
}

// ElGamal encryption in the exponent
export function elgamalEncrypt(publicKey: EdwardsPoint, message: number, randomValue?: bigint): ElGamalCiphertext {
  const r = randomValue || BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  const basePoint = EdwardsPoint.base();
  
  // c1 = r * G (where G is the base point)
  const c1 = basePoint.multiply(r);
  
  // Shared secret: r * pk
  const sharedSecret = publicKey.multiply(r);
  
  // m * G (message in the exponent)
  const mG = basePoint.multiply(BigInt(message));
  
  // c2 = sharedSecret + mG
  const c2 = sharedSecret.add(mG);
  
  return {
    c1: c1,
    c2: c2,
    r: r,
    ciphertext: [c1.x, c1.y, c2.x, c2.y]
  };
}

// Generate deterministic random value r = hash(sk, pk)
export async function generateDeterministicR(privateKey: bigint, publicKey: { x: bigint, y: bigint }): Promise<bigint> {
  const skBytes = toBytesBE(privateKey);
  const pkXBytes = toBytesBE(publicKey.x);
  const pkYBytes = toBytesBE(publicKey.y);
  
  const r = await hashToScalarBE(skBytes, pkXBytes, pkYBytes);
  console.log(`Generated deterministic r: ${r.toString()}`);
  return r;
}

// Create ElGamal encryption for nullification
export async function createNullificationEncryption(
  userKeypair: StoredKeypair,
  authorityPublicKey: { x: string, y: string }
): Promise<ElGamalCiphertext> {
  console.log("Creating nullification encryption...");
  
  // Convert authority public key to EdwardsPoint
  const authorityPoint = new EdwardsPoint(BigInt(authorityPublicKey.x), BigInt(authorityPublicKey.y));
  console.log(`Authority public key: ${authorityPoint.toString()}`);
  
  // Convert user public key to EdwardsPoint for deterministic r generation
  const userPublicKey = new EdwardsPoint(BigInt(userKeypair.Ax), BigInt(userKeypair.Ay));
  const userPrivateKey = BigInt(userKeypair.k);
  
  // Generate deterministic r = hash(sk, pk of that voter)
  const deterministicR = await generateDeterministicR(userPrivateKey, userPublicKey);
  
  // Encrypt the value 1 (nullification signal)
  const ciphertext = elgamalEncrypt(authorityPoint, 1, deterministicR);
  
  console.log("Nullification encryption created:");
  console.log(`c1: ${ciphertext.c1.toString()}`);
  console.log(`c2: ${ciphertext.c2.toString()}`);
  console.log(`r: ${ciphertext.r.toString()}`);
  
  return ciphertext;
}
