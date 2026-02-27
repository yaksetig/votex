import { Groth16Proof, VerificationKey } from "./proof";

declare module "snarkjs" {
  export namespace plonk {
    function fullProve(
      input: Record<string, string | string[]>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

    function verify(
      verificationKey: VerificationKey,
      publicSignals: string[],
      proof: Groth16Proof
    ): Promise<boolean>;
  }

  export namespace groth16 {
    function fullProve(
      input: Record<string, string | string[]>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

    function verify(
      verificationKey: VerificationKey,
      publicSignals: string[],
      proof: Groth16Proof
    ): Promise<boolean>;
  }

  export namespace fflonk {
    function fullProve(
      input: Record<string, string | string[]>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

    function verify(
      verificationKey: VerificationKey,
      publicSignals: string[],
      proof: Groth16Proof
    ): Promise<boolean>;
  }
}
