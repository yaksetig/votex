/**
 * Votex wire-protocol definitions shared by the browser and the edge
 * functions: signed-message formats, field encodings, canonical-decimal
 * parsing, curve constants and proof freshness rules.
 *
 * This file has no imports and uses only WebCrypto, so it runs unchanged in
 * Deno and in the browser. The frontend imports it through the `@protocol`
 * alias (vite.config.ts / vitest.config.ts / tsconfig.app.json); edge
 * functions import it relatively. Keep it dependency-free: anything that
 * needs circomlibjs or Supabase belongs next to its runtime instead.
 */

// ---------------------------------------------------------------------------
// BabyJubJub parameters (must match circomlib/circuits/babyjub.circom)
// ---------------------------------------------------------------------------

export const BABYJUB_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BABYJUB_SUBGROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;
export const BABYJUB_A = 168700n;
export const BABYJUB_D = 168696n;
export const BABYJUB_BASE_POINT = {
  x: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  y: 16950150798460657717958625567821834550301663161624707787222815936182638968203n,
} as const;

// ---------------------------------------------------------------------------
// Twisted Edwards arithmetic on BabyJubJub (a·x² + y² = 1 + d·x²·y² over F_p)
//
// This is the single implementation used by the browser (through the
// EdwardsPoint wrapper in src/services/elGamalService.ts), the edge-function
// point validators and the server-side accumulator update. Points are plain
// {x, y} bigints already reduced into [0, p).
// ---------------------------------------------------------------------------

export interface AffinePoint {
  x: bigint;
  y: bigint;
}

export const IDENTITY_POINT: AffinePoint = { x: 0n, y: 1n };

/** Least non-negative residue of `value` modulo `modulus`. */
export function mod(value: bigint, modulus: bigint = BABYJUB_FIELD): bigint {
  const remainder = value % modulus;
  return remainder >= 0n ? remainder : remainder + modulus;
}

/** Extended-Euclid modular inverse; null when `value` is not invertible. */
export function modInverse(value: bigint, modulus: bigint = BABYJUB_FIELD): bigint | null {
  let [oldR, r] = [mod(value, modulus), modulus];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  return oldR === 1n ? mod(oldS, modulus) : null;
}

export function isIdentityPoint(point: AffinePoint): boolean {
  return point.x === 0n && point.y === 1n;
}

export function isOnCurve(point: AffinePoint): boolean {
  const x2 = mod(point.x * point.x);
  const y2 = mod(point.y * point.y);
  return mod(BABYJUB_A * x2 + y2) === mod(1n + BABYJUB_D * x2 * y2);
}

/** Unified Edwards addition (also correct for doubling and for the identity). */
export function addPoints(left: AffinePoint, right: AffinePoint): AffinePoint {
  const x1x2 = mod(left.x * right.x);
  const y1y2 = mod(left.y * right.y);
  const product = mod(BABYJUB_D * x1x2 * y1y2);
  const xDenominator = modInverse(1n + product);
  const yDenominator = modInverse(1n - product);
  if (xDenominator === null || yDenominator === null) {
    throw new Error("Edwards addition failed: denominator is not invertible");
  }
  return {
    x: mod((left.x * right.y + left.y * right.x) * xDenominator),
    y: mod((y1y2 - BABYJUB_A * x1x2) * yDenominator),
  };
}

/** -(x, y) = (-x, y) on a twisted Edwards curve. */
export function negatePoint(point: AffinePoint): AffinePoint {
  return { x: mod(-point.x), y: point.y };
}

/** Double-and-add scalar multiplication; rejects negative scalars. */
export function multiplyPoint(point: AffinePoint, scalar: bigint): AffinePoint {
  if (scalar < 0n) {
    throw new Error("Point multiplication scalar cannot be negative");
  }
  let result: AffinePoint = IDENTITY_POINT;
  let addend = point;
  let remaining = scalar;
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) {
      result = addPoints(result, addend);
    }
    addend = addPoints(addend, addend);
    remaining >>= 1n;
  }
  return result;
}

/** On the curve and of order dividing the prime subgroup order. */
export function isInPrimeSubgroup(point: AffinePoint): boolean {
  return isOnCurve(point) && isIdentityPoint(multiplyPoint(point, BABYJUB_SUBGROUP_ORDER));
}

// ---------------------------------------------------------------------------
// Canonical decimal encoding of field elements
// ---------------------------------------------------------------------------

/** Unsigned decimal with no leading zeros, sign, whitespace or hex prefix. */
export const CANONICAL_DECIMAL = /^(0|[1-9][0-9]*)$/;
export const MAX_FIELD_ELEMENT_DIGITS = BABYJUB_FIELD.toString().length;

export function isCanonicalDecimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_FIELD_ELEMENT_DIGITS &&
    CANONICAL_DECIMAL.test(value)
  );
}

/**
 * Parse a coordinate or scalar as a canonical decimal in [0, p). Returns null
 * for aliases such as x + p, hex, signs, whitespace or oversized input, so
 * every field element has exactly one accepted encoding.
 */
export function parseCanonicalFieldElement(value: unknown): bigint | null {
  if (!isCanonicalDecimal(value)) {
    return null;
  }
  const parsed = BigInt(value);
  return parsed < BABYJUB_FIELD ? parsed : null;
}

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** 32-byte big-endian encoding of a field element. */
export function fieldElementToBytes(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let remaining = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  // Cast: Deno's lib types digest() as BufferSource over ArrayBuffer only.
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * The EdDSA-Poseidon prehash convention: SHA-256 of the UTF-8 message,
 * reduced into the BabyJubJub subgroup order. See CRYPTOGRAPHY.md §6.2.
 */
export async function hashMessageToField(message: string): Promise<bigint> {
  return BigInt(`0x${await sha256Hex(message)}`) % BABYJUB_SUBGROUP_ORDER;
}

/**
 * The World ID signal that binds a proof to a voting key:
 * `0x` + SHA-256(pk.x || pk.y) over 32-byte big-endian coordinates.
 * See CRYPTOGRAPHY.md §5.1.
 */
export async function hashPublicKeyForSignal(pk: {
  x: bigint | string;
  y: bigint | string;
}): Promise<string> {
  const bytes = new Uint8Array(64);
  bytes.set(fieldElementToBytes(BigInt(pk.x)), 0);
  bytes.set(fieldElementToBytes(BigInt(pk.y)), 32);
  return `0x${await sha256Hex(bytes)}`;
}

// ---------------------------------------------------------------------------
// World ID relying-party configuration shared by the widget, the RP signer
// and the registration verifier. The RP id can be overridden per deployment
// (WORLD_ID_RP_ID / VITE_WORLD_ID_RP_ID) but every side must agree.
// ---------------------------------------------------------------------------

export const WORLD_ID_REGISTRATION_ACTION = "registration";
export const WORLD_ID_DEFAULT_RP_ID = "rp_b3b4b36db636df22";

// ---------------------------------------------------------------------------
// Election id encoding for the nullification circuit
// ---------------------------------------------------------------------------

/**
 * Encode an election UUID as the 128-bit field element the nullification
 * circuit binds proofs to (public signal 16). See CRYPTOGRAPHY.md §9.1.
 */
export function electionIdToField(electionId: string): string {
  const hex = electionId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error("Election id must be a UUID");
  }
  return BigInt(`0x${hex}`).toString();
}

// ---------------------------------------------------------------------------
// Signed message formats. Every signed message is domain-separated with a
// versioned prefix and joined with ":". Fields that may contain ":" (none
// today) must never be appended without escaping.
// ---------------------------------------------------------------------------

export interface PublicKeyStrings {
  x: string;
  y: string;
}

export interface CiphertextStrings {
  c1: PublicKeyStrings;
  c2: PublicKeyStrings;
}

/** Ballot signature message (CRYPTOGRAPHY.md §6.3). */
export function buildVoteMessage(electionId: string, choice: string, timestamp: number): string {
  return `${electionId}:${choice}:${timestamp}`;
}

/** Fixed-authority ownership proof for account linking (§6.4). */
export function buildAuthorityLinkMessage(
  authUserId: string,
  publicKey: PublicKeyStrings,
  authorityName: string,
  issuedAt: number
): string {
  return [
    "votex:authority-link:v1",
    authUserId,
    publicKey.x,
    publicKey.y,
    authorityName,
    issuedAt.toString(),
  ].join(":");
}

/** Proof of possession of the voting key at World ID registration (§5.3). */
export function buildRegistrationOwnershipMessage(
  nullifier: string,
  publicKey: PublicKeyStrings,
  issuedAt: number
): string {
  return ["votex:register-keypair:v1", nullifier, publicKey.x, publicKey.y, issuedAt.toString()].join(
    ":"
  );
}

export type DelegationAction = "create" | "revoke";

/** Delegation authorisation message (§10). */
export function buildDelegationMessage(
  action: DelegationAction,
  electionId: string,
  issuedAt: number,
  ciphertext?: CiphertextStrings
): string {
  const parts = ["votex:delegation:v1", action, electionId];
  if (action === "create") {
    if (!ciphertext) {
      throw new Error("create delegation message requires a ciphertext");
    }
    parts.push(ciphertext.c1.x, ciphertext.c1.y, ciphertext.c2.x, ciphertext.c2.y);
  }
  parts.push(issuedAt.toString());
  return parts.join(":");
}

// ---------------------------------------------------------------------------
// Freshness window for every signed proof carrying an issuedAt timestamp
// ---------------------------------------------------------------------------

export const PROOF_MAX_AGE_MS = 5 * 60 * 1000;
export const PROOF_MAX_FUTURE_SKEW_MS = 60 * 1000;

export type FreshnessFailure = "MALFORMED" | "FUTURE" | "EXPIRED";

/**
 * Upper bound on a serialised EdDSA-Poseidon signature payload (two
 * coordinates, S, message: well under 1 KB). Caps what any signed request
 * may carry so oversized blobs are refused before parsing or storage.
 */
export const MAX_SIGNATURE_PAYLOAD_LENGTH = 2048;

/** Returns null when issuedAt is a safe integer inside the accepted window. */
export function checkProofFreshness(issuedAt: unknown, now: number = Date.now()): FreshnessFailure | null {
  if (typeof issuedAt !== "number" || !Number.isSafeInteger(issuedAt)) {
    return "MALFORMED";
  }
  if (issuedAt > now + PROOF_MAX_FUTURE_SKEW_MS) {
    return "FUTURE";
  }
  if (now - issuedAt > PROOF_MAX_AGE_MS) {
    return "EXPIRED";
  }
  return null;
}
