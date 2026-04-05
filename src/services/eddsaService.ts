import { Buffer } from "buffer";
import createBlakeHash from "blake-hash";
import { buildEddsa } from "circomlibjs";
import { CURVE_ORDER } from "@/services/crypto/constants";
import { bytesToHex } from "@/services/crypto/utils";

export const KEYPAIR_VERSION = "eddsa-seed-v1";

const HKDF_SALT = new TextEncoder().encode("votex:eddsa:seed-derivation");
const PASSKEY_SEED_INFO = new TextEncoder().encode("votex:eddsa:passkey-seed:v1");
const AUTHORITY_SEED_INFO = new TextEncoder().encode("votex:eddsa:authority-seed:v1");

type EddsaInstance = Awaited<ReturnType<typeof buildEddsa>>;

interface EdDSAPublicKey {
  x: bigint;
  y: bigint;
}

interface EdDSASignatureObject {
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

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index--) {
    value = (value << 8n) + BigInt(bytes[index]);
  }
  return value;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex seed must have an even number of characters");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function normalizeFieldValue(value: unknown): bigint {
  return BigInt(String(value));
}

function isIdentityPoint(point: EdDSAPublicKey): boolean {
  return point.x === 0n && point.y === 1n;
}

function toLibPoint(
  eddsa: EddsaInstance,
  point: EdDSAPublicKey
): [unknown, unknown] {
  return [eddsa.F.e(point.x), eddsa.F.e(point.y)];
}

function fromLibPoint(
  eddsa: EddsaInstance,
  point: [unknown, unknown]
): EdDSAPublicKey {
  return {
    x: normalizeFieldValue(eddsa.F.toObject(point[0])),
    y: normalizeFieldValue(eddsa.F.toObject(point[1])),
  };
}

async function hkdfSha256(
  keyMaterial: Uint8Array,
  info: Uint8Array
): Promise<Uint8Array> {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT,
      info,
    },
    importedKey,
    256
  );

  return new Uint8Array(derivedBits);
}

async function hashMessageToField(message: string): Promise<bigint> {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = bytesToHex(new Uint8Array(digest));
  return BigInt(`0x${hex}`) % CURVE_ORDER;
}

export async function deriveSeedFromPasskeySecret(
  prfSecret: ArrayBuffer
): Promise<Uint8Array> {
  return hkdfSha256(new Uint8Array(prfSecret), PASSKEY_SEED_INFO);
}

async function deriveAuthoritySeedFromSecret(
  authoritySecret: string
): Promise<Uint8Array> {
  const trimmedSecret = authoritySecret.trim();
  if (!trimmedSecret) {
    throw new Error("Authority secret is required");
  }

  return hkdfSha256(
    new TextEncoder().encode(trimmedSecret),
    AUTHORITY_SEED_INFO
  );
}

async function deriveSigningScalarFromSeed(
  seed: Uint8Array
): Promise<bigint> {
  const eddsa = await getEddsa();
  const digest = Uint8Array.from(
    createBlakeHash("blake512").update(Buffer.from(seed)).digest()
  );
  const pruned = eddsa.pruneBuffer(digest);
  const scalar = (bytesToBigIntLE(pruned.slice(0, 32)) >> 3n) % CURVE_ORDER;

  if (scalar <= 0n || scalar >= CURVE_ORDER) {
    throw new Error("Derived EdDSA scalar is out of range");
  }

  return scalar;
}

export async function deriveKeyMaterialFromSeed(seed: Uint8Array): Promise<{
  seed: Uint8Array;
  seedHex: string;
  scalar: bigint;
  publicKey: EdDSAPublicKey;
}> {
  if (seed.length !== 32) {
    throw new Error("EdDSA seed must be exactly 32 bytes");
  }

  const eddsa = await getEddsa();
  const publicKey = fromLibPoint(eddsa, eddsa.prv2pub(seed));
  const scalar = await deriveSigningScalarFromSeed(seed);

  if (isIdentityPoint(publicKey)) {
    throw new Error("Derived public key is the identity point");
  }

  if (!eddsa.babyJub.inCurve(toLibPoint(eddsa, publicKey))) {
    throw new Error("Derived public key is not on the BabyJubJub curve");
  }

  return {
    seed,
    seedHex: bytesToHex(seed),
    scalar,
    publicKey,
  };
}

export async function deriveAuthorityKeyMaterial(
  authoritySecret: string
): Promise<{
  seed: Uint8Array;
  seedHex: string;
  scalar: bigint;
  publicKey: EdDSAPublicKey;
}> {
  const seed = await deriveAuthoritySeedFromSecret(authoritySecret);
  return deriveKeyMaterialFromSeed(seed);
}

export async function validatePublicPoint(
  point: EdDSAPublicKey
): Promise<boolean> {
  if (isIdentityPoint(point)) {
    return false;
  }

  const eddsa = await getEddsa();
  const libPoint = toLibPoint(eddsa, point);
  return eddsa.babyJub.inCurve(libPoint) && eddsa.babyJub.inSubgroup(libPoint);
}

function buildSignaturePayload(
  signature: { R8: [unknown, unknown]; S: bigint },
  message: string,
  eddsa: EddsaInstance
): EdDSASignatureObject {
  const noncePoint = fromLibPoint(eddsa, signature.R8);

  return {
    R8: {
      x: noncePoint.x.toString(),
      y: noncePoint.y.toString(),
    },
    S: signature.S.toString(),
    message,
  };
}

export async function signMessageWithSeed(
  seed: Uint8Array,
  message: string
): Promise<EdDSASignatureObject> {
  const eddsa = await getEddsa();
  const msgField = await hashMessageToField(message);
  const signature = eddsa.signPoseidon(seed, eddsa.F.e(msgField));

  return buildSignaturePayload(signature, message, eddsa);
}

export async function signMessageWithStoredSeed(
  seedHex: string,
  message: string
): Promise<EdDSASignatureObject> {
  return signMessageWithSeed(hexToBytes(seedHex), message);
}

export async function verifySignatureObject(
  signature: EdDSASignatureObject,
  publicKey: EdDSAPublicKey,
  expectedMessage?: string
): Promise<boolean> {
  if (expectedMessage && signature.message !== expectedMessage) {
    return false;
  }

  const S = BigInt(signature.S);
  const noncePoint = {
    x: BigInt(signature.R8.x),
    y: BigInt(signature.R8.y),
  };

  if (S < 0n || S >= CURVE_ORDER) {
    return false;
  }

  const [publicKeyValid, nonceValid] = await Promise.all([
    validatePublicPoint(publicKey),
    validatePublicPoint(noncePoint),
  ]);

  if (!publicKeyValid || !nonceValid) {
    return false;
  }

  const eddsa = await getEddsa();
  const msgField = await hashMessageToField(signature.message);

  return eddsa.verifyPoseidon(
    eddsa.F.e(msgField),
    {
      R8: toLibPoint(eddsa, noncePoint),
      S,
    },
    toLibPoint(eddsa, publicKey)
  );
}

export function parseSignaturePayload(signature: string): EdDSASignatureObject {
  const parsed = JSON.parse(signature) as EdDSASignatureObject;

  if (!parsed?.R8?.x || !parsed?.R8?.y || !parsed?.S || !parsed?.message) {
    throw new Error("Signature payload is malformed");
  }

  return parsed;
}

export function publicKeyFromStrings(publicKey: {
  x: string;
  y: string;
}): EdDSAPublicKey {
  return {
    x: BigInt(publicKey.x),
    y: BigInt(publicKey.y),
  };
}
