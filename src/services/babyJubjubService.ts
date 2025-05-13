
import { buildBabyjub } from "circomlibjs";

// Use a more generic type since the imported BabyJub type is not available
let babyJub: any = null;
let ORDER: bigint;

async function getBabyJub(): Promise<any> {
  if (babyJub) return babyJub;
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto API unavailable; must run in a modern browser.");
  }
  babyJub = await buildBabyjub();
  console.log("🐣 circomlibjs babyJub ready:", babyJub);
  ORDER = babyJub.subOrder;
  return babyJub;
}

function randomScalar(order: bigint): bigint {
  const buf = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt("0x" + hex) % order;
}

export async function generateKeypair(): Promise<{
  k: bigint;
  Ax: bigint;
  Ay: bigint;
}> {
  const bj = await getBabyJub();
  const { F, Base8: B, subOrder } = bj;
  const k = randomScalar(subOrder);
  const A_e = bj.mulPointEscalar(B, k);
  const Ax = F.toObject(A_e[0]);
  const Ay = F.toObject(A_e[1]);
  return { k, Ax, Ay };
}
