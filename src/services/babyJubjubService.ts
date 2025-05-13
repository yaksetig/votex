// src/services/babyJubjubService.ts
import type { BabyJub } from "circomlibjs";
import { buildBabyjub } from "circomlibjs";

let babyJub: BabyJub | null = null;
let ORDER: bigint;

/**
 * Lazily initialize and cache the BabyJubJub instance.
 * Throws if WebCrypto API is unavailable.
 */
async function getBabyJub(): Promise<BabyJub> {
  if (babyJub) return babyJub;
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto API unavailable; must run in a browser.");
  }
  babyJub = await buildBabyjub();
  console.log("🐣 babyJub is ready:", babyJub);
  ORDER = babyJub.subOrder;
  return babyJub;
}

/** big-endian 32-byte encoder */
function toBytesBE(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** crypto-strong random scalar in [0, order) */
function randomScalar(order: bigint): bigint {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
  return BigInt("0x" + hex) % order;
}

/**
 * Generate a fresh keypair (public A = k·B, private k).
 * Ensures buildBabyjub() has completed and WebCrypto is available.
 */
export async function generateKeypair(): Promise<{ k: bigint; Ax: bigint; Ay: bigint }> {
  const bj = await getBabyJub();
  const { F, Base8: B, subOrder } = bj;
  const k = randomScalar(subOrder);
  const A_e = bj.mulPointEscalar(B, k);
  const Ax = F.toObject(A_e[0]);
  const Ay = F.toObject(A_e[1]);
  return { k, Ax, Ay };
}
