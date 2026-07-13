// circomlibjs does not ship accurate TypeScript declarations for buildEddsa.
// @ts-expect-error: circomlibjs ships no accurate type definitions
import { buildEddsa } from "npm:circomlibjs@0.1.7";
import { verifyPoseidonSignature } from "./eddsa.ts";

const CURVE_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

async function hashMessageToField(message: string): Promise<bigint> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(message)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return BigInt(`0x${hex}`) % CURVE_ORDER;
}

Deno.test("pinned edge verifier loads and accepts an existing-format signature", async () => {
  const eddsa = await buildEddsa();
  const seed = new Uint8Array(32).fill(7);
  const message = "votex:edge-verifier:cold-start-regression";
  const publicPoint = eddsa.prv2pub(seed);
  const signature = eddsa.signPoseidon(
    seed,
    eddsa.F.e(await hashMessageToField(message))
  );

  const publicKey = {
    x: BigInt(eddsa.F.toObject(publicPoint[0])).toString(),
    y: BigInt(eddsa.F.toObject(publicPoint[1])).toString(),
  };
  const serializedSignature = JSON.stringify({
    R8: {
      x: BigInt(eddsa.F.toObject(signature.R8[0])).toString(),
      y: BigInt(eddsa.F.toObject(signature.R8[1])).toString(),
    },
    S: signature.S.toString(),
    message,
  });

  const valid = await verifyPoseidonSignature(
    serializedSignature,
    publicKey,
    message
  );
  if (!valid) {
    throw new Error("The edge verifier rejected a valid existing-format signature");
  }
});
