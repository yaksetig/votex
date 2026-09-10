// Test-only helpers for the Deno edge-function suites: deterministic
// BabyJubJub keypairs and EdDSA-Poseidon signatures in the exact serialised
// form the browser produces (see src/services/eddsaService.ts). Not imported
// by any function.

// @ts-expect-error: circomlibjs ships no accurate type definitions
import { buildEddsa } from "npm:circomlibjs@0.1.7";
import { hashMessageToField, type PublicKeyStrings } from "./protocol.ts";

// deno-lint-ignore no-explicit-any
type EddsaInstance = any;

let eddsaPromise: Promise<EddsaInstance> | undefined;

function getEddsa(): Promise<EddsaInstance> {
  eddsaPromise ??= buildEddsa() as Promise<EddsaInstance>;
  return eddsaPromise;
}

export interface TestKeypair {
  seed: Uint8Array;
  pk: PublicKeyStrings;
}

function pointToStrings(eddsa: EddsaInstance, point: unknown[]): PublicKeyStrings {
  return {
    x: BigInt(eddsa.F.toObject(point[0])).toString(),
    y: BigInt(eddsa.F.toObject(point[1])).toString(),
  };
}

/** Deterministic keypair from a 32-byte seed filled with `fill`. */
export async function makeTestKeypair(fill: number): Promise<TestKeypair> {
  const eddsa = await getEddsa();
  const seed = new Uint8Array(32).fill(fill);
  return { seed, pk: pointToStrings(eddsa, eddsa.prv2pub(seed)) };
}

/** Sign `message` with the browser's prehash convention; returns the JSON payload string. */
export async function signTestMessage(seed: Uint8Array, message: string): Promise<string> {
  const eddsa = await getEddsa();
  const signature = eddsa.signPoseidon(seed, eddsa.F.e(await hashMessageToField(message)));
  return JSON.stringify({
    R8: pointToStrings(eddsa, signature.R8),
    S: signature.S.toString(),
    message,
  });
}
