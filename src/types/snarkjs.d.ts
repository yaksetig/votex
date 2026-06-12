// Ambient declaration for the untyped `snarkjs` package. Kept free of
// top-level import/export so `declare module` is a global ambient declaration
// (a top-level import would turn this into a module augmentation that the
// worker's `import * as snarkjs from "snarkjs"` cannot resolve).

declare module "snarkjs" {
  type Groth16Proof = import("./proof").Groth16Proof;
  type VerificationKey = import("./proof").VerificationKey;

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
