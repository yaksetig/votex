import { StoredKeypair } from "@/types/keypair";
import { CURVE_ORDER, BASE_POINT } from "@/services/crypto/constants";
import { randomScalar } from "@/services/crypto/utils";
import {
  addPoints,
  type AffinePoint,
  IDENTITY_POINT,
  isIdentityPoint,
  isInPrimeSubgroup,
  isOnCurve,
  mod,
  multiplyPoint,
  negatePoint as negateAffinePoint,
} from "@protocol";

/**
 * BabyJubJub point in affine coordinates. The arithmetic lives in the shared
 * protocol module so the browser, the edge verifiers and the tests all run
 * the same curve law; this class only adds the object-style API the
 * ElGamal and accumulator code is written against.
 */
export class EdwardsPoint implements AffinePoint {
  readonly x: bigint;
  readonly y: bigint;

  constructor(x: bigint, y: bigint) {
    this.x = mod(x);
    this.y = mod(y);
  }

  static from(point: AffinePoint): EdwardsPoint {
    return new EdwardsPoint(point.x, point.y);
  }

  static identity(): EdwardsPoint {
    return EdwardsPoint.from(IDENTITY_POINT);
  }

  static base(): EdwardsPoint {
    return EdwardsPoint.from(BASE_POINT);
  }

  isOnCurve(): boolean {
    return isOnCurve(this);
  }

  isIdentity(): boolean {
    return isIdentityPoint(this);
  }

  isInPrimeSubgroup(): boolean {
    return isInPrimeSubgroup(this);
  }

  add(other: AffinePoint): EdwardsPoint {
    return EdwardsPoint.from(addPoints(this, other));
  }

  multiply(scalar: bigint): EdwardsPoint {
    return EdwardsPoint.from(multiplyPoint(this, scalar));
  }

  negate(): EdwardsPoint {
    return EdwardsPoint.from(negatePoint(this));
  }

  toString(): string {
    return `(${this.x.toString()}, ${this.y.toString()})`;
  }

  equals(other: AffinePoint): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

// Derive public key from private key
export function derivePublicKey(privateKey: bigint): EdwardsPoint {
  if (privateKey <= 0n || privateKey >= CURVE_ORDER) {
    throw new Error("Private key scalar is outside the prime subgroup range");
  }

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
  if (!Number.isSafeInteger(message) || message < 0) {
    throw new Error("ElGamal message must be a non-negative safe integer");
  }
  if (
    publicKey.isIdentity() ||
    !publicKey.isOnCurve() ||
    !publicKey.isInPrimeSubgroup()
  ) {
    throw new Error("ElGamal public key must be a non-identity prime-subgroup point");
  }
  if (r <= 0n || r >= CURVE_ORDER) {
    throw new Error("ElGamal randomness must be in the prime subgroup scalar range");
  }
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

/** -(x, y) = (-x, y); used to subtract ciphertexts and for the x=0 gate branch. */
export function negatePoint(point: EdwardsPoint): EdwardsPoint {
  return EdwardsPoint.from(negateAffinePoint(point));
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
  if (x !== 0 && x !== 1) {
    throw new Error("XOR selector must be binary");
  }
  if (s <= 0n || s >= CURVE_ORDER) {
    throw new Error("XOR gate randomness must be in the prime subgroup scalar range");
  }
  if (
    authorityPublicKey.isIdentity() ||
    !authorityPublicKey.isOnCurve() ||
    !authorityPublicKey.isInPrimeSubgroup()
  ) {
    throw new Error("Authority key must be a non-identity prime-subgroup point");
  }
  for (const point of [accumulator.c1, accumulator.c2]) {
    if (!point.isOnCurve() || !point.isInPrimeSubgroup()) {
      throw new Error("Accumulator contains an invalid BabyJubJub point");
    }
  }

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
