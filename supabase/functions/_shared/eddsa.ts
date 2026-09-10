// Use Deno's pinned npm resolver so deployed edge workers do not depend on
// esm.sh being reachable during cold start. circomlibjs does not ship accurate
// TypeScript declarations for buildEddsa, so the import remains untyped.
// @ts-expect-error: circomlibjs ships no accurate type definitions
import { buildEddsa } from "npm:circomlibjs@0.1.7";

import {
  BABYJUB_SUBGROUP_ORDER as CURVE_ORDER,
  hashMessageToField,
  parseCanonicalFieldElement,
} from "./protocol.ts";

// deno-lint-ignore no-explicit-any
type EddsaInstance = any;

interface ParsedSignature {
  R8: {
    x: string;
    y: string;
  };
  S: string;
  message: string;
}

let eddsaPromise: Promise<EddsaInstance> | undefined;

function getEddsa(): Promise<EddsaInstance> {
  eddsaPromise ??= buildEddsa() as Promise<EddsaInstance>;
  return eddsaPromise;
}

function normalizeFieldValue(value: unknown): bigint {
  return BigInt(String(value));
}

function toLibPoint(
  eddsa: EddsaInstance,
  point: { x: bigint; y: bigint }
): [unknown, unknown] {
  return [eddsa.F.e(point.x), eddsa.F.e(point.y)];
}

function isIdentityPoint(point: { x: bigint; y: bigint }): boolean {
  return point.x === 0n && point.y === 1n;
}

async function validatePoint(point: { x: bigint; y: bigint }): Promise<boolean> {
  if (isIdentityPoint(point)) {
    return false;
  }

  const eddsa = await getEddsa();
  const libPoint = toLibPoint(eddsa, point);
  return eddsa.babyJub.inCurve(libPoint) && eddsa.babyJub.inSubgroup(libPoint);
}

function parseSignature(signature: string): ParsedSignature {
  const parsed = JSON.parse(signature) as ParsedSignature;
  if (!parsed?.R8?.x || !parsed?.R8?.y || !parsed?.S || !parsed?.message) {
    throw new Error("Malformed EdDSA signature payload");
  }
  return parsed;
}

export async function verifyPoseidonSignature(
  signature: string,
  publicKey: { x: string; y: string },
  expectedMessage: string
): Promise<boolean> {
  const parsed = parseSignature(signature);
  if (parsed.message !== expectedMessage) {
    return false;
  }

  const S = parseCanonicalFieldElement(parsed.S);
  if (S === null || S >= CURVE_ORDER) {
    return false;
  }

  const r8x = parseCanonicalFieldElement(parsed.R8.x);
  const r8y = parseCanonicalFieldElement(parsed.R8.y);
  const pkx = parseCanonicalFieldElement(publicKey.x);
  const pky = parseCanonicalFieldElement(publicKey.y);
  if (r8x === null || r8y === null || pkx === null || pky === null) {
    return false;
  }

  const noncePoint = { x: r8x, y: r8y };
  const authorityPoint = { x: pkx, y: pky };

  const [publicKeyValid, nonceValid] = await Promise.all([
    validatePoint(authorityPoint),
    validatePoint(noncePoint),
  ]);

  if (!publicKeyValid || !nonceValid) {
    return false;
  }

  const eddsa = await getEddsa();
  const msgField = await hashMessageToField(expectedMessage);

  return eddsa.verifyPoseidon(
    eddsa.F.e(msgField),
    {
      R8: toLibPoint(eddsa, noncePoint),
      S: normalizeFieldValue(S),
    },
    toLibPoint(eddsa, authorityPoint)
  );
}
