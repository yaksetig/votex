import { EdwardsPoint } from "@/services/elGamalService";
import { CURVE_ORDER } from "@/services/crypto/constants";
import { randomScalar } from "@/services/crypto/utils";

export async function generateKeypair(): Promise<{
  k: bigint;
  Ax: bigint;
  Ay: bigint;
}> {
  // Generate random private key
  const k = randomScalar(CURVE_ORDER);

  // Compute public key: A = k * G
  const publicKeyPoint = EdwardsPoint.base().multiply(k);

  // Verify the point is on curve
  if (!publicKeyPoint.isOnCurve()) {
    throw new Error("Generated public key is not on curve!");
  }

  return {
    k,
    Ax: publicKeyPoint.x,
    Ay: publicKeyPoint.y,
  };
}
