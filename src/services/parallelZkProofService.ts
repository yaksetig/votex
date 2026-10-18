// Parallel ZK proof generation using Web Workers

import { Groth16Proof } from "@/types/proof";
import { logger } from "@/services/logger";

export interface ProofInput {
  id: string;
  input: {
    ciphertext: string[];
    gate_output: string[];
    accumulator: string[];
    pk_voter: string[];
    pk_authority: string[];
    election_id: string;
    x: string;
    r: string;
    s: string;
    sk_voter: string;
  };
}

interface ProofResult {
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
const WASM_PATH = `${BASE_URL}nullification_xor.wasm`;
const ZKEY_PATH = `${BASE_URL}nullification_xor_final.zkey`;

function abortError(): Error {
  return typeof DOMException !== "undefined"
    ? new DOMException("Proof generation was cancelled", "AbortError")
    : Object.assign(new Error("Proof generation was cancelled"), { name: "AbortError" });
}

// Generate multiple proofs in parallel using Web Workers. Aborting `signal`
// terminates every worker immediately and rejects with an AbortError.
export async function generateProofsInParallel(
  proofInputs: ProofInput[],
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal
): Promise<ProofResult[]> {
  const total = proofInputs.length;
  let completed = 0;

  if (signal?.aborted) {
    throw abortError();
  }

  logger.debug(`Starting parallel proof generation for ${total} proofs...`);

  const workers: Worker[] = [];
  let rejectAll: ((error: Error) => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAll = reject;
  });
  const onAbort = () => {
    workers.forEach((worker) => worker.terminate());
    rejectAll?.(abortError());
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  const workerPromises: Promise<ProofResult>[] = proofInputs.map(
    (proofInput) => {
      return new Promise((resolve) => {
        const worker = new Worker(
          new URL("../workers/zkProofWorker.ts", import.meta.url),
          { type: "module" }
        );
        workers.push(worker);

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

  try {
    const allResults = await Promise.race([Promise.all(workerPromises), aborted]);
    logger.debug(`All ${total} proofs completed`);
    return allResults;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
