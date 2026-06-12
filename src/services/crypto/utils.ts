import { CURVE_ORDER } from "./constants";

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
  const buf = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt("0x" + hex) % order;
}
