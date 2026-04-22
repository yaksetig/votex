import * as snarkjs from "https://esm.sh/snarkjs@0.7.5?bundle";

import { verificationKeyXor } from "./verificationKeyXor.ts";

const FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const BABYJUBJUB_D = 168696n;
const BABYJUBJUB_A = 168700n;

export interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: "groth16";
  curve: string;
}

export interface NullificationProofPayload {
  proof: Groth16Proof;
  publicSignals: string[];
}

export interface JsonPoint {
  x: string;
  y: string;
}

export interface JsonCiphertext {
  c1: JsonPoint;
  c2: JsonPoint;
}

export interface ParsedNullificationSignals {
  accumulator: JsonCiphertext;
  authorityPublicKey: JsonPoint;
  ciphertext: JsonCiphertext;
  gateOutput: JsonCiphertext;
  voterPublicKey: JsonPoint;
}

class EdwardsPoint {
  x: bigint;
  y: bigint;

  constructor(x: bigint, y: bigint) {
    this.x = mod(x, FIELD_SIZE);
    this.y = mod(y, FIELD_SIZE);
  }

  add(other: EdwardsPoint): EdwardsPoint {
    const x1 = this.x;
    const y1 = this.y;
    const x2 = other.x;
    const y2 = other.y;

    const x1y2 = (x1 * y2) % FIELD_SIZE;
    const y1x2 = (y1 * x2) % FIELD_SIZE;
    const y1y2 = (y1 * y2) % FIELD_SIZE;
    const x1x2 = (x1 * x2) % FIELD_SIZE;
    const dx1x2y1y2 = (BABYJUBJUB_D * x1x2 * y1y2) % FIELD_SIZE;

    const x3Num = (x1y2 + y1x2) % FIELD_SIZE;
    const x3Den = modInverse((1n + dx1x2y1y2) % FIELD_SIZE, FIELD_SIZE);
    const y3Num = (y1y2 - BABYJUBJUB_A * x1x2) % FIELD_SIZE;
    const y3Den = modInverse(
      (1n - dx1x2y1y2 + FIELD_SIZE) % FIELD_SIZE,
      FIELD_SIZE
    );

    if (x3Den === null || y3Den === null) {
      throw new Error("Point addition failed");
    }

    return new EdwardsPoint((x3Num * x3Den) % FIELD_SIZE, (y3Num * y3Den) % FIELD_SIZE);
  }
}

function mod(value: bigint, modulus: bigint): bigint {
  const remainder = value % modulus;
  return remainder >= 0n ? remainder : remainder + modulus;
}

function modInverse(value: bigint, modulus: bigint): bigint | null {
  let a = mod(value, modulus);
  let b = modulus;
  let x = 1n;
  let y = 0n;

  while (b !== 0n) {
    const quotient = a / b;
    [a, b] = [b, a % b];
    [x, y] = [y, x - quotient * y];
  }

  if (a !== 1n) {
    return null;
  }

  return mod(x, modulus);
}

function negatePoint(point: EdwardsPoint): EdwardsPoint {
  return new EdwardsPoint(-point.x, point.y);
}

function pointFromJson(point: JsonPoint): EdwardsPoint {
  return new EdwardsPoint(BigInt(point.x), BigInt(point.y));
}

function pointToJson(point: EdwardsPoint): JsonPoint {
  return {
    x: point.x.toString(),
    y: point.y.toString(),
  };
}

function ciphertextFromPoints(c1: EdwardsPoint, c2: EdwardsPoint): JsonCiphertext {
  return {
    c1: pointToJson(c1),
    c2: pointToJson(c2),
  };
}

function signalPoint(publicSignals: string[], startIndex: number): JsonPoint {
  return {
    x: BigInt(publicSignals[startIndex]).toString(),
    y: BigInt(publicSignals[startIndex + 1]).toString(),
  };
}

export function parseNullificationSignals(
  publicSignals: string[]
): ParsedNullificationSignals {
  if (!Array.isArray(publicSignals) || publicSignals.length !== 16) {
    throw new Error("Nullification proof must expose exactly 16 public signals");
  }

  return {
    ciphertext: {
      c1: signalPoint(publicSignals, 0),
      c2: signalPoint(publicSignals, 2),
    },
    gateOutput: {
      c1: signalPoint(publicSignals, 4),
      c2: signalPoint(publicSignals, 6),
    },
    accumulator: {
      c1: signalPoint(publicSignals, 8),
      c2: signalPoint(publicSignals, 10),
    },
    voterPublicKey: signalPoint(publicSignals, 12),
    authorityPublicKey: signalPoint(publicSignals, 14),
  };
}

export async function verifyNullificationProofPayload(
  payload: NullificationProofPayload
): Promise<ParsedNullificationSignals | null> {
  const valid = await snarkjs.groth16.verify(
    verificationKeyXor,
    payload.publicSignals,
    payload.proof
  );

  if (!valid) {
    return null;
  }

  return parseNullificationSignals(payload.publicSignals);
}

export function computeAccumulatorUpdate(
  parsed: ParsedNullificationSignals
): JsonCiphertext {
  const ciphertextC1 = pointFromJson(parsed.ciphertext.c1);
  const ciphertextC2 = pointFromJson(parsed.ciphertext.c2);
  const gateC1 = pointFromJson(parsed.gateOutput.c1);
  const gateC2 = pointFromJson(parsed.gateOutput.c2);

  return ciphertextFromPoints(
    ciphertextC1.add(negatePoint(gateC1)),
    ciphertextC2.add(negatePoint(gateC2))
  );
}

export function identityCiphertextJson(): JsonCiphertext {
  return {
    c1: { x: "0", y: "1" },
    c2: { x: "0", y: "1" },
  };
}

export function equalPoints(left: JsonPoint, right: JsonPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

export function equalCiphertexts(
  left: JsonCiphertext,
  right: JsonCiphertext
): boolean {
  return equalPoints(left.c1, right.c1) && equalPoints(left.c2, right.c2);
}
