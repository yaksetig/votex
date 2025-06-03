
import { EdwardsPoint } from "@/services/elGamalService";

// BabyJubJub curve parameters (same as in elGamalService.ts)
const CURVE_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;

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
  // Generate random private key
  const k = randomScalar(CURVE_ORDER);
  
  // Get base point
  const basePoint = EdwardsPoint.base();
  
  // Compute public key: A = k * G
  const publicKeyPoint = basePoint.multiply(k);
  
  // Verify the point is on curve
  if (!publicKeyPoint.isOnCurve()) {
    throw new Error("Generated public key is not on curve!");
  }
  
  return { 
    k, 
    Ax: publicKeyPoint.x, 
    Ay: publicKeyPoint.y 
  };
}
