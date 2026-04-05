import { StoredKeypair } from "@/types/keypair";
import {
  CURVE_ORDER,
  FIELD_SIZE,
  BABYJUBJUB_D as D,
  BABYJUBJUB_A as A,
  BASE_POINT,
} from "@/services/crypto/constants";
import {
  mod,
  modInverse,
  randomScalar,
} from "@/services/crypto/utils";

// Edwards curve point operations for BabyJubJub
export class EdwardsPoint {
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
    const x1 = this.x,
      y1 = this.y;
    const x2 = other.x,
      y2 = other.y;

    const x1y2 = (x1 * y2) % FIELD_SIZE;
    const y1x2 = (y1 * x2) % FIELD_SIZE;
    const y1y2 = (y1 * y2) % FIELD_SIZE;
    const x1x2 = (x1 * x2) % FIELD_SIZE;

    const dx1x2y1y2 = (D * x1x2 * y1y2) % FIELD_SIZE;

    const x3_num = (x1y2 + y1x2) % FIELD_SIZE;
    const x3_den = modInverse((1n + dx1x2y1y2) % FIELD_SIZE, FIELD_SIZE);

    const y3_num = (y1y2 - A * x1x2) % FIELD_SIZE;
    const y3_den = modInverse(
      (1n - dx1x2y1y2 + FIELD_SIZE) % FIELD_SIZE,
      FIELD_SIZE
    );

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

// Derive public key from private key
export function derivePublicKey(privateKey: bigint): EdwardsPoint {
  const basePoint = EdwardsPoint.base();
  const publicKey = basePoint.multiply(privateKey);

  if (!publicKey.isOnCurve()) {
    throw new Error("Derived public key is not on curve!");
  }

  return publicKey;
}

// Verify keypair consistency
export function verifyKeypairConsistency(keypair: StoredKeypair): boolean {
  try {
    const privateKey = BigInt(keypair.k);
    const expectedPublicKey = derivePublicKey(privateKey);

    const actualPublicKeyX = BigInt(keypair.Ax);
    const actualPublicKeyY = BigInt(keypair.Ay);

    return (
      expectedPublicKey.x === actualPublicKeyX &&
      expectedPublicKey.y === actualPublicKeyY
    );
  } catch {
    return false;
  }
}

// ElGamalCiphertext interface
export interface ElGamalCiphertext {
  c1: EdwardsPoint;
  c2: EdwardsPoint;
  r: bigint;
  ciphertext: [bigint, bigint, bigint, bigint];
}

// ElGamal encryption in the exponent
export function elgamalEncrypt(
  publicKey: EdwardsPoint,
  message: number,
  randomValue?: bigint
): ElGamalCiphertext {
  const r = randomValue ?? randomScalar(CURVE_ORDER);
  const basePoint = EdwardsPoint.base();

  const c1 = basePoint.multiply(r);
  const sharedSecret = publicKey.multiply(r);
  const mG = basePoint.multiply(BigInt(message));
  const c2 = sharedSecret.add(mG);

  return {
    c1: c1,
    c2: c2,
    r: r,
    ciphertext: [c1.x, c1.y, c2.x, c2.y],
  };
}

// ===== XOR Accumulator Operations =====

// Negate an Edwards point: -(x, y) = (-x, y)
export function negatePoint(point: EdwardsPoint): EdwardsPoint {
  return new EdwardsPoint(-point.x, point.y);
}

// Subtract two ciphertexts: [[a]] - [[b]] = ([[a]].c1 - [[b]].c1, [[a]].c2 - [[b]].c2)
export function subtractCiphertexts(
  a: ElGamalCiphertext,
  b: ElGamalCiphertext
): ElGamalCiphertext {
  const c1 = a.c1.add(negatePoint(b.c1));
  const c2 = a.c2.add(negatePoint(b.c2));
  return {
    c1,
    c2,
    r: 0n,
    ciphertext: [c1.x, c1.y, c2.x, c2.y],
  };
}

// Compute the XOR conditional gate output.
// Given x in {0,1} and accumulator [[y]], computes:
//   x' = 2x - 1  (maps {0,1} -> {-1,1})
//   gate_c1 = s*G + x' * acc_c1  (conditional negation)
//   gate_c2 = s*H + x' * acc_c2
export function computeXorGate(
  x: number,
  accumulator: ElGamalCiphertext,
  authorityPublicKey: EdwardsPoint,
  s: bigint
): ElGamalCiphertext {
  const basePoint = EdwardsPoint.base();

  // x' = 2x - 1: when x=0 -> -1 (negate), when x=1 -> +1 (keep)
  const condAcc_c1 = x === 1 ? accumulator.c1 : negatePoint(accumulator.c1);
  const condAcc_c2 = x === 1 ? accumulator.c2 : negatePoint(accumulator.c2);

  // s*G and s*H
  const sG = basePoint.multiply(s);
  const sH = authorityPublicKey.multiply(s);

  // gate = (s*G + x'*acc_c1, s*H + x'*acc_c2)
  const gate_c1 = sG.add(condAcc_c1);
  const gate_c2 = sH.add(condAcc_c2);

  return {
    c1: gate_c1,
    c2: gate_c2,
    r: s,
    ciphertext: [gate_c1.x, gate_c1.y, gate_c2.x, gate_c2.y],
  };
}

// Compute the new XOR accumulator: new_acc = [[x]] - [[x'y]]
export function computeXorAccumulator(
  freshCiphertext: ElGamalCiphertext,
  gateOutput: ElGamalCiphertext
): ElGamalCiphertext {
  return subtractCiphertexts(freshCiphertext, gateOutput);
}

// Create the identity ciphertext [[0]] = (O, O) where O is the identity point
export function identityCiphertext(): ElGamalCiphertext {
  const id = EdwardsPoint.identity();
  return {
    c1: id,
    c2: id,
    r: 0n,
    ciphertext: [id.x, id.y, id.x, id.y],
  };
}
