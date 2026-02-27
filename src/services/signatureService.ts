import { buildBabyjub } from "circomlibjs";
import { StoredKeypair } from "@/types/keypair";
import { CURVE_ORDER } from "@/services/crypto/constants";
import { toBytesBE, stringToBytes, hashToScalarBE } from "@/services/crypto/utils";
import { logger } from "@/services/logger";

// circomlibjs BabyJubjub instance (field-element representation)
interface BabyJubInstance {
  F: {
    e: (v: bigint) => unknown;
    toObject: (v: unknown) => bigint;
  };
  Base8: [unknown, unknown];
  subOrder: bigint;
  mulPointEscalar: (p: unknown, s: bigint) => [unknown, unknown];
  addPoint: (a: [unknown, unknown], b: [unknown, unknown]) => [unknown, unknown];
}

let babyJub: BabyJubInstance | null = null;

async function getBabyJub(): Promise<BabyJubInstance> {
  if (babyJub) return babyJub;

  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto API unavailable; must run in a modern browser.");
  }

  babyJub = (await buildBabyjub()) as unknown as BabyJubInstance;
  return babyJub;
}

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
  const bj = await getBabyJub();
  const { F } = bj;

  const privateKey = BigInt(keypair.k);
  const Ax = BigInt(keypair.Ax);

  const timestamp = Date.now();
  const message = `${electionId}:${choice}:${timestamp}`;
  const msgBytes = stringToBytes(message);

  // Generate the internal nonce (r)
  const r = await hashToScalarBE(CURVE_ORDER, toBytesBE(privateKey), msgBytes);

  // Calculate R = r*B
  const R_e = bj.mulPointEscalar(bj.Base8, r);
  const Rx = F.toObject(R_e[0]);
  const Ry = F.toObject(R_e[1]);

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
    const bj = await getBabyJub();
    const { F } = bj;

    const sigObj = JSON.parse(signature);
    const s = BigInt(sigObj.s);
    const Rx = BigInt(sigObj.R.x);
    const Ry = BigInt(sigObj.R.y);
    const msgBytes = stringToBytes(sigObj.message);

    const Ax = BigInt(publicKey.x);
    const Ay = BigInt(publicKey.y);

    const R_e: [unknown, unknown] = [F.e(Rx), F.e(Ry)];
    const A_e: [unknown, unknown] = [F.e(Ax), F.e(Ay)];

    // Calculate challenge t = H(Rx || Ax || message)
    const t = await hashToScalarBE(
      CURVE_ORDER,
      toBytesBE(Rx),
      toBytesBE(Ax),
      msgBytes
    );

    // Verify: sB = R + tA
    const sB = bj.mulPointEscalar(bj.Base8, s);
    const tA = bj.mulPointEscalar(A_e, t);
    const rhs = bj.addPoint(R_e, tA);

    const sB_x = F.toObject(sB[0]);
    const sB_y = F.toObject(sB[1]);
    const rhs_x = F.toObject(rhs[0]);
    const rhs_y = F.toObject(rhs[1]);

    return sB_x === rhs_x && sB_y === rhs_y;
  } catch (error) {
    logger.error("Signature verification failed:", error);
    return false;
  }
}
