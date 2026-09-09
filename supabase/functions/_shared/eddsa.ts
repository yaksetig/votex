// Use Deno's pinned npm resolver so deployed edge workers do not depend on
// esm.sh being reachable during cold start. circomlibjs does not ship accurate
// TypeScript declarations for buildEddsa, so the import remains untyped.
// @ts-expect-error: circomlibjs ships no accurate type definitions
import { buildEddsa } from "npm:circomlibjs@0.1.7";

const CURVE_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const CANONICAL_DECIMAL = /^(0|[1-9][0-9]*)$/;
const MAX_DECIMAL_DIGITS = FIELD_SIZE.toString().length;

/**
 * Parse a coordinate or scalar as a canonical decimal string in [0, p).
 * Rejects aliases such as x + p, hex, signs, whitespace and oversized input
 * so the same point has exactly one accepted encoding.
 */
function parseCanonicalFieldElement(value: unknown): bigint | null {
  if (typeof value !== "string" || value.length > MAX_DECIMAL_DIGITS || !CANONICAL_DECIMAL.test(value)) {
    return null;
  }
  const parsed = BigInt(value);
  return parsed < FIELD_SIZE ? parsed : null;
}

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

async function hashMessageToField(message: string): Promise<bigint> {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hashBytes = new Uint8Array(digest);
  const hex = Array.from(hashBytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return BigInt(`0x${hex}`) % CURVE_ORDER;
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
