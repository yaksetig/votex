import { StoredKeypair } from "@/types/keypair";
import { CURVE_ORDER } from "@/services/crypto/constants";
import { toBytesBE, stringToBytes, hashToScalarBE } from "@/services/crypto/utils";
import { EdwardsPoint } from "@/services/elGamalService";
import { logger } from "@/services/logger";

// Sign a message with the user's keypair
export async function signVote(
  keypair: StoredKeypair,
  electionId: string,
  choice: string
): Promise<{
  signature: string;
  publicKey: { x: string; y: string };
  timestamp: number;
}> {
  const privateKey = BigInt(keypair.k);
  const Ax = BigInt(keypair.Ax);

  const timestamp = Date.now();
  const message = `${electionId}:${choice}:${timestamp}`;
  const msgBytes = stringToBytes(message);

  // Generate the internal nonce (r)
  const r = await hashToScalarBE(CURVE_ORDER, toBytesBE(privateKey), msgBytes);

  // Calculate R = r*B
  const rPoint = EdwardsPoint.base().multiply(r);
  const Rx = rPoint.x;
  const Ry = rPoint.y;

  // Calculate challenge t = H(Rx || Ax || message)
  const t = await hashToScalarBE(
    CURVE_ORDER,
    toBytesBE(Rx),
    toBytesBE(Ax),
    msgBytes
  );

  // Calculate signature s = (r + privateKey * t) mod ORDER
  const s = (r + privateKey * t) % CURVE_ORDER;

  const signatureObject = {
    R: { x: Rx.toString(), y: Ry.toString() },
    s: s.toString(),
    message,
  };

  return {
    signature: JSON.stringify(signatureObject),
    publicKey: { x: keypair.Ax, y: keypair.Ay },
    timestamp,
  };
}

// Verify a signature
export async function verifySignature(
  signature: string,
  publicKey: { x: string; y: string }
): Promise<boolean> {
  try {
    const sigObj = JSON.parse(signature);
    const s = BigInt(sigObj.s);
    const Rx = BigInt(sigObj.R.x);
    const Ry = BigInt(sigObj.R.y);
    const msgBytes = stringToBytes(sigObj.message);

    const Ax = BigInt(publicKey.x);
    const Ay = BigInt(publicKey.y);

    if (s < 0n || s >= CURVE_ORDER) {
      return false;
    }

    const rPoint = new EdwardsPoint(Rx, Ry);
    const publicKeyPoint = new EdwardsPoint(Ax, Ay);

    if (!rPoint.isOnCurve() || !publicKeyPoint.isOnCurve()) {
      return false;
    }

    // Calculate challenge t = H(Rx || Ax || message)
    const t = await hashToScalarBE(
      CURVE_ORDER,
      toBytesBE(Rx),
      toBytesBE(Ax),
      msgBytes
    );

    // Verify: sB = R + tA
    const sB = EdwardsPoint.base().multiply(s);
    const rhs = rPoint.add(publicKeyPoint.multiply(t));

    return sB.equals(rhs);
  } catch (error) {
    logger.error("Signature verification failed:", error);
    return false;
  }
}
