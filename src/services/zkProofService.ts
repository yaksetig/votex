
import * as snarkjs from "snarkjs";
import { StoredKeypair } from "@/types/keypair";
import { ElGamalCiphertext } from "@/services/elGamalService";

// Paths to pre-compiled circuit artifacts
const WASM_PATH = "/circuits/nullification.wasm";
const ZKEY_PATH = "/circuits/nullification_final.zkey";
const VKEY_PATH = "/circuits/verification_key.json";

// Cache for verification key
let verificationKey: any = null;

async function loadVerificationKey(): Promise<any> {
  if (!verificationKey) {
    const response = await fetch(VKEY_PATH);
    verificationKey = await response.json();
  }
  return verificationKey;
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
    throw new Error(`Failed to generate PLONK proof: ${error}`);
  }
}

// Verify PLONK proof
export async function verifyNullificationProof(
  proof: any,
  publicSignals: string[]
): Promise<boolean> {
  try {
    const vkey = await loadVerificationKey();
    const valid = await snarkjs.plonk.verify(vkey, publicSignals, proof);
    console.log("PLONK proof verification result:", valid);
    return valid;
  } catch (error) {
    console.error("Error verifying PLONK proof:", error);
    return false;
  }
}
