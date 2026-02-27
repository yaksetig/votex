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

export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export async function sha256(msg: Uint8Array): Promise<Uint8Array> {
  // Create a new ArrayBuffer to avoid SharedArrayBuffer type issues
  const buffer = new ArrayBuffer(msg.length);
  new Uint8Array(buffer).set(msg);
  const h = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(h);
}

export async function hashToScalarBE(
  order: bigint,
  ...parts: Uint8Array[]
): Promise<bigint> {
  const all = Uint8Array.from(parts.flatMap((p) => [...p]));
  const d = await sha256(all);
  const hex = bytesToHex(d);
  return BigInt("0x" + hex) % order;
}

export function randomScalar(order: bigint = CURVE_ORDER): bigint {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt("0x" + hex) % order;
}
