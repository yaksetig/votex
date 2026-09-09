import { CURVE_ORDER, FIELD_SIZE } from "./constants";

export function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

export function modInverse(a: bigint, m: bigint): bigint | null {
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

export function toBytesBE(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomScalar(order: bigint = CURVE_ORDER): bigint {
  if (order <= 1n) {
    throw new Error("Scalar order must be greater than one");
  }

  // Rejection sampling avoids modulo bias and never returns the zero scalar.
  const bitLength = (order - 1n).toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);
  const unusedHighBits = byteLength * 8 - bitLength;

  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    if (unusedHighBits > 0) {
      bytes[0] &= 0xff >>> unusedHighBits;
    }

    const hex = Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const candidate = BigInt(`0x${hex}`);
    if (candidate > 0n && candidate < order) {
      return candidate;
    }
  }
}

export function parseCanonicalFieldElement(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("Field element must use canonical unsigned decimal encoding");
  }

  const parsed = BigInt(value);
  if (parsed >= FIELD_SIZE) {
    throw new Error("Field element is outside the BabyJubJub base field");
  }

  return parsed;
}

/**
 * Encode an election UUID as the 128-bit field element the nullification
 * circuit binds proofs to. Must match `electionIdToField` in
 * supabase/functions/_shared/nullification.ts.
 */
export function electionIdToField(electionId: string): string {
  const hex = electionId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error("Election id must be a UUID");
  }
  return BigInt(`0x${hex}`).toString();
}
