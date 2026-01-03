
import * as snarkjs from "snarkjs";
import { StoredKeypair } from "@/types/keypair";
import { ElGamalCiphertext } from "@/services/elGamalService";

// Get base URL for circuit files (Supabase Storage or local)
function getCircuitFilesBaseUrl(): string {
  const envUrl = import.meta.env.VITE_CIRCUIT_FILES_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
  }
  return '/circuits/';
}

// Paths to pre-compiled circuit artifacts
const BASE_URL = getCircuitFilesBaseUrl();
const WASM_PATH = `${BASE_URL}nullification.wasm`;
const ZKEY_PATH = `${BASE_URL}nullification_final.zkey`;
const VKEY_PATH = `${BASE_URL}verification_key.json`;

// Cache for verification key
let verificationKey: any = null;

async function loadVerificationKey(): Promise<any> {
  if (!verificationKey) {
    const response = await fetch(VKEY_PATH);
    verificationKey = await response.json();
  }
  return verificationKey;
}

// Generate Groth16 proof for nullification
export async function generateNullificationProof(
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string; y: string },
  ciphertext: ElGamalCiphertext,
  deterministicR: bigint,
  message: number = 1 // 1 for actual nullification, 0 for dummy
): Promise<{ proof: any; publicSignals: string[] }> {
  try {
    console.log(`Generating Groth16 proof for ${message === 1 ? "actual" : "dummy"} nullification...`);

    const input = {
      // Public inputs
      ciphertext: [
        ciphertext.c1.x.toString(),
        ciphertext.c1.y.toString(),
        ciphertext.c2.x.toString(),
        ciphertext.c2.y.toString(),
      ],
      pk_voter: [voterKeypair.Ax, voterKeypair.Ay],
      pk_authority: [authorityPublicKey.x, authorityPublicKey.y],
      // Private inputs
      r: deterministicR.toString(),
      m: message.toString(),
      sk_voter: voterKeypair.k,
    };

    console.log("Computing witness and generating Groth16 proof with inputs:", {
      ciphertext: input.ciphertext,
      pk_voter: input.pk_voter,
      pk_authority: input.pk_authority,
      r: input.r,
      m: input.m,
      sk_voter: "***hidden***",
    });

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );

    console.log("Groth16 proof generated successfully:", { proof, publicSignals });
    return { proof, publicSignals };
  } catch (error) {
    console.error("Error generating Groth16 proof:", error);
    
    // Provide helpful error message
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
  proof: any,
  publicSignals: string[]
): Promise<boolean> {
  try {
    const vkey = await loadVerificationKey();
    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    console.log("Groth16 proof verification result:", valid);
    return valid;
  } catch (error) {
    console.error("Error verifying Groth16 proof:", error);
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
