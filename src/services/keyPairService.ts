
import { BabyJubjubKeyPair } from '@/services/babyJubjubService';

export const signWithKeypair = (message: string, keypair: BabyJubjubKeyPair): string => {
  throw new Error('This function has been migrated to babyJubjubService.ts');
};

export const getPublicKeyString = (publicKey: Uint8Array): string => {
  throw new Error('This function has been migrated to babyJubjubService.ts');
};

export interface KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

// This is just a compatibility shim to ensure code that still
// references this file doesn't break during the transition
