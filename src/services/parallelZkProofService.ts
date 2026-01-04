// Parallel ZK proof generation using Web Workers

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
  proof?: any;
  publicSignals?: string[];
  error?: string;
}

// Get base URL for circuit files
function getCircuitFilesBaseUrl(): string {
  const envUrl = import.meta.env.VITE_CIRCUIT_FILES_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
  }
  return '/circuits/';
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
  const results: ProofResult[] = [];

  console.log(`Starting parallel proof generation for ${total} proofs...`);

  // Determine how many workers to spawn (min of inputs length and available cores)
  const maxWorkers = Math.min(navigator.hardwareConcurrency || 4, total);
  console.log(`Using ${maxWorkers} parallel workers`);

  // Create a pool of promises
  const workerPromises: Promise<ProofResult>[] = proofInputs.map((proofInput) => {
    return new Promise((resolve) => {
      // Create a new worker for each proof
      const worker = new Worker(
        new URL("../workers/zkProofWorker.ts", import.meta.url),
        { type: "module" }
      );

      // Set up message handler
      worker.onmessage = (event: MessageEvent) => {
        const result = event.data as ProofResult;
        completed++;
        
        console.log(`Proof ${completed}/${total} completed`);
        onProgress?.(completed, total);
        
        // Terminate the worker
        worker.terminate();
        
        resolve(result);
      };

      // Handle worker errors
      worker.onerror = (error) => {
        completed++;
        console.error(`Worker error for proof ${proofInput.id}:`, error);
        onProgress?.(completed, total);
        
        worker.terminate();
        
        resolve({
          id: proofInput.id,
          success: false,
          error: error.message || "Worker error",
        });
      };

      // Send the proof generation request
      worker.postMessage({
        id: proofInput.id,
        input: proofInput.input,
        wasmPath: WASM_PATH,
        zkeyPath: ZKEY_PATH,
      });
    });
  });

  // Wait for all proofs to complete
  const allResults = await Promise.all(workerPromises);
  
  console.log(`All ${total} proofs completed`);
  
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
