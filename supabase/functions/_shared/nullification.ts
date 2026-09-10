import * as snarkjsModule from "https://esm.sh/snarkjs@0.7.5?bundle";

// The @types/snarkjs package esm.sh attaches lacks the groth16 namespace,
// so the module is used untyped.
// deno-lint-ignore no-explicit-any
const snarkjs = snarkjsModule as any;

import { verificationKeyXor } from "./verificationKeyXor.ts";
import {
  addPoints,
  type AffinePoint,
  electionIdToField,
  isCanonicalDecimal,
  mod,
  negatePoint,
} from "./protocol.ts";


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
  /** Election UUID as a decimal 128-bit field element (see electionIdToField). */
  electionId: string;
  gateOutput: JsonCiphertext;
  voterPublicKey: JsonPoint;
}

export const NULLIFICATION_PUBLIC_SIGNAL_COUNT = 17;

export { electionIdToField };

function pointFromJson(point: JsonPoint): AffinePoint {
  return { x: mod(BigInt(point.x)), y: mod(BigInt(point.y)) };
}

function pointToJson(point: AffinePoint): JsonPoint {
  return {
    x: point.x.toString(),
    y: point.y.toString(),
  };
}

function ciphertextFromPoints(c1: AffinePoint, c2: AffinePoint): JsonCiphertext {
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
  if (
    !Array.isArray(publicSignals) ||
    publicSignals.length !== NULLIFICATION_PUBLIC_SIGNAL_COUNT
  ) {
    throw new Error(
      `Nullification proof must expose exactly ${NULLIFICATION_PUBLIC_SIGNAL_COUNT} public signals`
    );
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
    electionId: BigInt(publicSignals[16]).toString(),
  };
}

/**
 * Shape-check a proof payload before handing it to snarkjs: exactly the
 * expected number of public signals, every coordinate a bounded canonical
 * decimal (V8 BigInt parsing is superlinear, so unbounded digit strings are a
 * cheap CPU sink), and the declared protocol/curve.
 */
export function isWellFormedProofPayload(payload: unknown): payload is NullificationProofPayload {
  if (!payload || typeof payload !== "object") return false;
  const { proof, publicSignals } = payload as Partial<NullificationProofPayload>;
  if (
    !Array.isArray(publicSignals) ||
    publicSignals.length !== NULLIFICATION_PUBLIC_SIGNAL_COUNT ||
    !publicSignals.every(isCanonicalDecimal)
  ) {
    return false;
  }
  if (!proof || typeof proof !== "object") return false;
  if (proof.protocol !== "groth16" || proof.curve !== "bn128") return false;
  const g1 = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every(isCanonicalDecimal);
  const g2 = (value: unknown) =>
    Array.isArray(value) && value.length === 3 &&
    value.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isCanonicalDecimal));
  return g1(proof.pi_a) && g2(proof.pi_b) && g1(proof.pi_c);
}

export async function verifyNullificationProofPayload(
  payload: NullificationProofPayload
): Promise<ParsedNullificationSignals | null> {
  if (!isWellFormedProofPayload(payload)) {
    return null;
  }

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
    addPoints(ciphertextC1, negatePoint(gateC1)),
    addPoints(ciphertextC2, negatePoint(gateC2))
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
