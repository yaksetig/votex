import {
  deriveKeyMaterialFromSeed,
  KEYPAIR_VERSION,
} from "@/services/eddsaService";

export async function generateKeypair(): Promise<{
  version: string;
  seed: string;
  k: bigint;
  Ax: bigint;
  Ay: bigint;
}> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const keyMaterial = await deriveKeyMaterialFromSeed(seed);

  return {
    version: KEYPAIR_VERSION,
    seed: keyMaterial.seedHex,
    k: keyMaterial.scalar,
    Ax: keyMaterial.publicKey.x,
    Ay: keyMaterial.publicKey.y,
  };
}
