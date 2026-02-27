import * as snarkjs from "snarkjs";
import { StoredKeypair } from "@/types/keypair";
import { Groth16Proof, VerificationKey } from "@/types/proof";
import { ElGamalCiphertext } from "@/services/elGamalService";
import { logger } from "@/services/logger";

// Get base URL for circuit files (Supabase Storage or local)
function getCircuitFilesBaseUrl(): string {
  const envUrl = import.meta.env.VITE_CIRCUIT_FILES_URL;
  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl : `${envUrl}/`;
  }
  return "/circuits/";
}

// Paths to pre-compiled circuit artifacts
const BASE_URL = getCircuitFilesBaseUrl();
const WASM_PATH = `${BASE_URL}nullification.wasm`;
const ZKEY_PATH = `${BASE_URL}nullification_final.zkey`;
const VKEY_PATH = `${BASE_URL}verification_key.json`;

// Cache for verification key
let verificationKey: VerificationKey | null = null;

async function loadVerificationKey(): Promise<VerificationKey> {
  if (!verificationKey) {
    const response = await fetch(VKEY_PATH);
    verificationKey = (await response.json()) as VerificationKey;
  }
  return verificationKey;
}

// Generate Groth16 proof for nullification
export async function generateNullificationProof(
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string; y: string },
  ciphertext: ElGamalCiphertext,
  deterministicR: bigint,
  message: number = 1
): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
  try {
    logger.debug(
      `Generating Groth16 proof for ${message === 1 ? "actual" : "dummy"} nullification...`
    );

    const input = {
      ciphertext: [
        ciphertext.c1.x.toString(),
        ciphertext.c1.y.toString(),
        ciphertext.c2.x.toString(),
        ciphertext.c2.y.toString(),
      ],
      pk_voter: [voterKeypair.Ax, voterKeypair.Ay],
      pk_authority: [authorityPublicKey.x, authorityPublicKey.y],
      r: deterministicR.toString(),
      m: message.toString(),
      sk_voter: voterKeypair.k,
    };

    logger.debug("Computing witness and generating Groth16 proof...");

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );

    logger.debug("Groth16 proof generated successfully");
    return { proof, publicSignals };
  } catch (error) {
    logger.error("Error generating Groth16 proof:", error);

    if (error instanceof Error && error.message.includes("404")) {
      throw new Error(
        "Circuit artifacts not found. Please compile the Circom circuit and upload to Supabase Storage. " +
          "See circuits/README.md for instructions."
      );
    }

    throw new Error(`Failed to generate Groth16 proof: ${error}`);
  }
}

// Verify Groth16 proof
export async function verifyNullificationProof(
  proof: Groth16Proof,
  publicSignals: string[]
): Promise<boolean> {
  try {
    const vkey = await loadVerificationKey();
    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    logger.debug("Groth16 proof verification result:", valid);
    return valid;
  } catch (error) {
    logger.error("Error verifying Groth16 proof:", error);
    return false;
  }
}

// Check circuit files availability
export async function checkCircuitFilesAvailable(): Promise<{
  available: boolean;
  missing: string[];
}> {
  const files = [WASM_PATH, ZKEY_PATH, VKEY_PATH];
  const missing: string[] = [];

  for (const file of files) {
    try {
      const response = await fetch(file, { method: "HEAD" });
      if (!response.ok) {
        missing.push(file);
      }
    } catch {
      missing.push(file);
    }
  }

  return {
    available: missing.length === 0,
    missing,
  };
}
