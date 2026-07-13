import type { Groth16Proof } from "../../src/types/proof";

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

const deterministicProof: Groth16Proof = {
  pi_a: ["1", "2", "1"],
  pi_b: [["3", "4"], ["5", "6"], ["1", "0"]],
  pi_c: ["7", "8", "1"],
  protocol: "groth16",
  curve: "bn128",
};

export async function generateProofsInParallel(
  proofInputs: ProofInput[],
  onProgress?: (completed: number, total: number) => void
) {
  return proofInputs.map((proofInput, index) => {
    onProgress?.(index + 1, proofInputs.length);
    return {
      id: proofInput.id,
      success: true,
      proof: deterministicProof,
      publicSignals: [
        ...proofInput.input.ciphertext,
        ...proofInput.input.gate_output,
        ...proofInput.input.accumulator,
        ...proofInput.input.pk_voter,
        ...proofInput.input.pk_authority,
      ],
    };
  });
}
