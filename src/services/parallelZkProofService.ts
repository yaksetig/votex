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
    x: string;
    r: string;
    s: string;
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
const WASM_PATH = `${BASE_URL}nullification_xor.wasm`;
const ZKEY_PATH = `${BASE_URL}nullification_xor_final.zkey`;

// Cached circuit artifacts (fetched once, reused across all workers)
let cachedWasm: ArrayBuffer | null = null;
let cachedZkey: ArrayBuffer | null = null;
let prefetchPromise: Promise<void> | null = null;

/**
 * Pre-fetch and cache circuit artifacts (wasm + zkey) as ArrayBuffers.
 * Safe to call multiple times — concurrent calls coalesce into one fetch.
 * Call early (e.g. when a user navigates to an election) to hide latency.
 */
export async function prefetchCircuitArtifacts(): Promise<void> {
  if (cachedWasm && cachedZkey) return;

  if (!prefetchPromise) {
    prefetchPromise = (async () => {
      logger.debug("Pre-fetching circuit artifacts...");
      const [wasmResp, zkeyResp] = await Promise.all([
        fetch(WASM_PATH),
        fetch(ZKEY_PATH),
      ]);
      if (!wasmResp.ok) throw new Error(`Failed to fetch wasm: ${wasmResp.status}`);
      if (!zkeyResp.ok) throw new Error(`Failed to fetch zkey: ${zkeyResp.status}`);
      [cachedWasm, cachedZkey] = await Promise.all([
        wasmResp.arrayBuffer(),
        zkeyResp.arrayBuffer(),
      ]);
      logger.debug(
        `Circuit artifacts cached (wasm: ${(cachedWasm!.byteLength / 1024).toFixed(0)} KB, ` +
        `zkey: ${(cachedZkey!.byteLength / 1024).toFixed(0)} KB)`
      );
    })();
  }

  await prefetchPromise;
}

// Generate multiple proofs in parallel using Web Workers
export async function generateProofsInParallel(
  proofInputs: ProofInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<ProofResult[]> {
  const total = proofInputs.length;
  let completed = 0;

  logger.debug(`Starting parallel proof generation for ${total} proofs...`);

  // Ensure artifacts are cached before spawning workers
  await prefetchCircuitArtifacts();

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

        // Pass cached ArrayBuffers via structured clone (copies in memory,
        // but avoids each worker re-fetching over the network)
        worker.postMessage({
          id: proofInput.id,
          input: proofInput.input,
          wasmData: cachedWasm!,
          zkeyData: cachedZkey!,
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

  // Use cached artifacts if available, otherwise fall back to URLs
  await prefetchCircuitArtifacts();
  const wasmSource = cachedWasm ? new Uint8Array(cachedWasm) : WASM_PATH;
  const zkeySource = cachedZkey ? new Uint8Array(cachedZkey) : ZKEY_PATH;

  for (let i = 0; i < proofInputs.length; i++) {
    const proofInput = proofInputs[i];

    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        proofInput.input,
        wasmSource,
        zkeySource
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
