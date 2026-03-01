// Web Worker for parallel ZK proof generation
import * as snarkjs from "snarkjs";

// Worker receives messages with proof generation inputs.
// Accepts pre-fetched ArrayBuffer data for wasm/zkey to avoid redundant
// network fetches across workers.
self.onmessage = async (event: MessageEvent) => {
  const { id, input, wasmData, zkeyData } = event.data;

  try {
    console.log(`[Worker ${id}] Starting proof generation...`);

    // snarkjs accepts Uint8Array directly — no network fetch needed
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      new Uint8Array(wasmData),
      new Uint8Array(zkeyData)
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
