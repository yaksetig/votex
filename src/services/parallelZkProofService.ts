// Parallel ZK proof generation using Web Workers

import { Groth16Proof } from "@/types/proof";
import { logger } from "@/services/logger";

export interface ProofInput {
  id: string;
  input: {
    ciphertext: string[];
    pk_voter: string[];
    pk_authority: string[];
    r: string;
    m: string;
    sk_voter: string;
  };
}

export interface ProofResult {
  id: string;
  success: boolean;
  proof?: Groth16Proof;
  publicSignals?: string[];
  error?: string;
}

// Get base URL for circuit files
function getCircuitFilesBaseUrl(): string {
  const envUrl = import.meta.env.VITE_CIRCUIT_FILES_URL;
  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl : `${envUrl}/`;
  }
  return "/circuits/";
}

const BASE_URL = getCircuitFilesBaseUrl();
const WASM_PATH = `${BASE_URL}nullification.wasm`;
const ZKEY_PATH = `${BASE_URL}nullification_final.zkey`;

// Generate multiple proofs in parallel using Web Workers
export async function generateProofsInParallel(
  proofInputs: ProofInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<ProofResult[]> {
  const total = proofInputs.length;
  let completed = 0;

  logger.debug(`Starting parallel proof generation for ${total} proofs...`);

  const workerPromises: Promise<ProofResult>[] = proofInputs.map(
    (proofInput) => {
      return new Promise((resolve) => {
        const worker = new Worker(
          new URL("../workers/zkProofWorker.ts", import.meta.url),
          { type: "module" }
        );

        worker.onmessage = (event: MessageEvent) => {
          const result = event.data as ProofResult;
          completed++;

          logger.debug(`Proof ${completed}/${total} completed`);
          onProgress?.(completed, total);

          worker.terminate();
          resolve(result);
        };

        worker.onerror = (error) => {
          completed++;
          logger.error(`Worker error for proof ${proofInput.id}:`, error);
          onProgress?.(completed, total);

          worker.terminate();
          resolve({
            id: proofInput.id,
            success: false,
            error: error.message || "Worker error",
          });
        };

        worker.postMessage({
          id: proofInput.id,
          input: proofInput.input,
          wasmPath: WASM_PATH,
          zkeyPath: ZKEY_PATH,
        });
      });
    }
  );

  const allResults = await Promise.all(workerPromises);

  logger.debug(`All ${total} proofs completed`);
  return allResults;
}

// Fallback: Generate proofs sequentially (if workers not available)
export async function generateProofsSequentially(
  proofInputs: ProofInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<ProofResult[]> {
  const snarkjs = await import("snarkjs");
  const results: ProofResult[] = [];
  const total = proofInputs.length;

  for (let i = 0; i < proofInputs.length; i++) {
    const proofInput = proofInputs[i];

    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        proofInput.input,
        WASM_PATH,
        ZKEY_PATH
      );

      results.push({
        id: proofInput.id,
        success: true,
        proof,
        publicSignals,
      });
    } catch (error) {
      results.push({
        id: proofInput.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    onProgress?.(i + 1, total);
  }

  return results;
}
