
declare module 'circomlibjs' {
  export function buildBabyjub(): Promise<{
    F: any;
    subOrder: bigint;
    Base8: [any, any];
    mulPointEscalar: (base: [any, any], scalar: any) => [any, any];
    poseidon: (inputs: any[]) => any;
    signPoseidon: (privateKey: any, message: any) => { R8: [any, any]; S: any };
    verifyPoseidon: (message: any, signature: { R8: [any, any]; S: any }, publicKey: [any, any]) => boolean;
  }>;
}
