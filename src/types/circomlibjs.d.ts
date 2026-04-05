declare module 'circomlibjs' {
  export function buildEddsa(): Promise<{
    F: {
      e: (value: bigint | number | string) => unknown;
      toObject: (value: unknown) => bigint | number | string;
    };
    babyJub: {
      subOrder: bigint;
      inCurve: (point: [unknown, unknown]) => boolean;
      inSubgroup: (point: [unknown, unknown]) => boolean;
    };
    pruneBuffer: (buffer: Uint8Array) => Uint8Array;
    prv2pub: (privateKey: Uint8Array) => [unknown, unknown];
    signPoseidon: (
      privateKey: Uint8Array,
      message: unknown
    ) => { R8: [unknown, unknown]; S: bigint };
    verifyPoseidon: (
      message: unknown,
      signature: { R8: [unknown, unknown]; S: bigint },
      publicKey: [unknown, unknown]
    ) => boolean;
  }>;
}

declare module "blake-hash" {
  const createBlakeHash: (algorithm: string) => {
    update: (input: Uint8Array | string) => {
      digest: () => Uint8Array;
    };
    digest: () => Uint8Array;
  };

  export default createBlakeHash;
}
