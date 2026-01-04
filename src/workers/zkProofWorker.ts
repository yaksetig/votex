// Web Worker for parallel ZK proof generation
import * as snarkjs from "snarkjs";

// Worker receives messages with proof generation inputs
self.onmessage = async (event: MessageEvent) => {
  const { id, input, wasmPath, zkeyPath } = event.data;

  try {
    console.log(`[Worker ${id}] Starting proof generation...`);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log(`[Worker ${id}] Proof generated successfully`);

    self.postMessage({
      id,
      success: true,
      proof,
      publicSignals,
    });
  } catch (error) {
    console.error(`[Worker ${id}] Proof generation failed:`, error);
    
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
