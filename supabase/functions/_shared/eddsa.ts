import { buildEddsa } from "https://esm.sh/circomlibjs@0.1.7?bundle";

const CURVE_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

type EddsaInstance = Awaited<ReturnType<typeof buildEddsa>>;

interface ParsedSignature {
  R8: {
    x: string;
    y: string;
  };
  S: string;
  message: string;
}

let eddsaPromise: Promise<EddsaInstance> | null = null;

function getEddsa(): Promise<EddsaInstance> {
  if (!eddsaPromise) {
    eddsaPromise = buildEddsa();
  }
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

  const S = BigInt(parsed.S);
  if (S < 0n || S >= CURVE_ORDER) {
    return false;
  }

  const noncePoint = {
    x: BigInt(parsed.R8.x),
    y: BigInt(parsed.R8.y),
  };
  const authorityPoint = {
    x: BigInt(publicKey.x),
    y: BigInt(publicKey.y),
  };

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
