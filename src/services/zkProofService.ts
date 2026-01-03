
import * as snarkjs from "snarkjs";
import { StoredKeypair } from "@/types/keypair";
import { ElGamalCiphertext } from "@/services/elGamalService";

// Paths to pre-compiled circuit artifacts
const WASM_PATH = "/circuits/nullification.wasm";
const ZKEY_PATH = "/circuits/nullification_final.zkey";
const VKEY_PATH = "/circuits/verification_key.json";

// Cache for verification key
let verificationKey: any = null;

// Check if dev mode is enabled (bypasses ZK proofs for testing)
function isDevModeEnabled(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("DEV_SKIP_ZK_PROOFS") === "true";
  }
  return false;
}

async function loadVerificationKey(): Promise<any> {
  if (!verificationKey) {
    const response = await fetch(VKEY_PATH);
    verificationKey = await response.json();
  }
  return verificationKey;
}

// Generate mock proof for development/testing
function generateMockProof(
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string; y: string },
  ciphertext: ElGamalCiphertext,
  message: number
): { proof: any; publicSignals: string[] } {
  console.warn("⚠️ DEV MODE: Generating mock ZK proof (not cryptographically valid)");
  
  const mockProof = {
    protocol: "plonk",
    curve: "bn128",
    A: ["0x1", "0x2", "0x3"],
    B: ["0x4", "0x5", "0x6"],
    C: ["0x7", "0x8", "0x9"],
    Z: ["0xa", "0xb", "0xc"],
    T1: ["0xd", "0xe", "0xf"],
    T2: ["0x10", "0x11", "0x12"],
    T3: ["0x13", "0x14", "0x15"],
    Wxi: ["0x16", "0x17", "0x18"],
    Wxiw: ["0x19", "0x1a", "0x1b"],
    eval_a: "0x1c",
    eval_b: "0x1d",
    eval_c: "0x1e",
    eval_s1: "0x1f",
    eval_s2: "0x20",
    eval_zw: "0x21",
    _devMode: true,
    _timestamp: Date.now(),
  };

  const publicSignals = [
    ciphertext.c1.x.toString(),
    ciphertext.c1.y.toString(),
    ciphertext.c2.x.toString(),
    ciphertext.c2.y.toString(),
    voterKeypair.Ax,
    voterKeypair.Ay,
    authorityPublicKey.x,
    authorityPublicKey.y,
  ];

  return { proof: mockProof, publicSignals };
}

// Generate PLONK proof for nullification
export async function generateNullificationProof(
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string; y: string },
  ciphertext: ElGamalCiphertext,
  deterministicR: bigint,
  message: number = 1 // 1 for actual nullification, 0 for dummy
): Promise<{ proof: any; publicSignals: string[] }> {
  try {
    console.log(`Generating PLONK proof for ${message === 1 ? "actual" : "dummy"} nullification...`);

    // Check for dev mode bypass
    if (isDevModeEnabled()) {
      return generateMockProof(voterKeypair, authorityPublicKey, ciphertext, message);
    }

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

    console.log("Computing witness and generating PLONK proof with inputs:", {
      ciphertext: input.ciphertext,
      pk_voter: input.pk_voter,
      pk_authority: input.pk_authority,
      r: input.r,
      m: input.m,
      sk_voter: "***hidden***",
    });

    const { proof, publicSignals } = await snarkjs.plonk.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );

    console.log("PLONK proof generated successfully:", { proof, publicSignals });
    return { proof, publicSignals };
  } catch (error) {
    console.error("Error generating PLONK proof:", error);
    
    // Provide helpful error message
    if (error instanceof Error && error.message.includes("404")) {
      throw new Error(
        "Circuit artifacts not found. Please compile the Circom circuit first. " +
        "See circuits/README.md for instructions, or enable dev mode: " +
        "localStorage.setItem('DEV_SKIP_ZK_PROOFS', 'true')"
      );
    }
    
    throw new Error(`Failed to generate PLONK proof: ${error}`);
  }
}

// Verify PLONK proof
export async function verifyNullificationProof(
  proof: any,
  publicSignals: string[]
): Promise<boolean> {
  try {
    // Check for dev mode - always return true for mock proofs
    if (isDevModeEnabled() || proof._devMode) {
      console.warn("⚠️ DEV MODE: Skipping real proof verification (mock proof accepted)");
      return true;
    }

    const vkey = await loadVerificationKey();
    const valid = await snarkjs.plonk.verify(vkey, publicSignals, proof);
    console.log("PLONK proof verification result:", valid);
    return valid;
  } catch (error) {
    console.error("Error verifying PLONK proof:", error);
    return false;
  }
}

// Utility to enable/disable dev mode
export function setDevMode(enabled: boolean): void {
  if (typeof window !== "undefined") {
    if (enabled) {
      localStorage.setItem("DEV_SKIP_ZK_PROOFS", "true");
      console.log("✅ Dev mode enabled - ZK proofs will be mocked");
    } else {
      localStorage.removeItem("DEV_SKIP_ZK_PROOFS");
      console.log("✅ Dev mode disabled - real ZK proofs required");
    }
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
