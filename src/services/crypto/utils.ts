import { CURVE_ORDER } from "./constants";
import { parseCanonicalFieldElement as parseCanonicalFieldElementOrNull } from "@protocol";

export { mod, modInverse } from "@protocol";

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

/**
 * Parse a canonical decimal field element, throwing on any alias. The
 * null-returning primitive lives in @protocol; this wrapper keeps the
 * throwing contract the tally and accumulator code rely on.
 */
export function parseCanonicalFieldElement(value: string): bigint {
  const parsed = parseCanonicalFieldElementOrNull(value);
  if (parsed === null) {
    throw new Error("Field element must use canonical unsigned decimal encoding in [0, p)");
  }
  return parsed;
}

export { electionIdToField } from "@protocol";
