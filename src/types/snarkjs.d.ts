declare module "snarkjs" {
  export namespace plonk {
    function fullProve(
      input: Record<string, any>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: any; publicSignals: string[] }>;

    function verify(
      verificationKey: any,
      publicSignals: string[],
      proof: any
    ): Promise<boolean>;
  }

  export namespace groth16 {
    function fullProve(
      input: Record<string, any>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: any; publicSignals: string[] }>;

    function verify(
      verificationKey: any,
      publicSignals: string[],
      proof: any
    ): Promise<boolean>;
  }

  export namespace fflonk {
    function fullProve(
      input: Record<string, any>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: any; publicSignals: string[] }>;

    function verify(
      verificationKey: any,
      publicSignals: string[],
      proof: any
    ): Promise<boolean>;
  }
}
