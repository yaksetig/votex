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

Deno.test("edge verifier rejects wrong message, wrong key, out-of-range S, and malformed payloads", async () => {
  const eddsa = await buildEddsa();
  const seed = new Uint8Array(32).fill(7);
  const otherSeed = new Uint8Array(32).fill(8);
  const message = "votex:edge-verifier:negative";
  const toKey = (point: unknown[]) => ({
    x: BigInt(eddsa.F.toObject(point[0])).toString(),
    y: BigInt(eddsa.F.toObject(point[1])).toString(),
  });
  const publicKey = toKey(eddsa.prv2pub(seed));
  const otherKey = toKey(eddsa.prv2pub(otherSeed));
  const signature = eddsa.signPoseidon(seed, eddsa.F.e(await hashMessageToField(message)));
  const payload = {
    R8: toKey(signature.R8),
    S: signature.S.toString(),
    message,
  };

  const serialize = (p: Record<string, unknown>) => JSON.stringify(p);
  if (!(await verifyPoseidonSignature(serialize(payload), publicKey, message))) {
    throw new Error("control signature should verify");
  }
  if (await verifyPoseidonSignature(serialize(payload), publicKey, message + "x")) {
    throw new Error("accepted a different expected message");
  }
  if (await verifyPoseidonSignature(serialize(payload), otherKey, message)) {
    throw new Error("accepted a signature under the wrong key");
  }
  if (await verifyPoseidonSignature(serialize({ ...payload, S: CURVE_ORDER.toString() }), publicKey, message)) {
    throw new Error("accepted S >= subgroup order");
  }
  if (await verifyPoseidonSignature(serialize({ ...payload, R8: { x: "0", y: "1" } }), publicKey, message)) {
    throw new Error("accepted the identity as R8");
  }
  const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const aliasedR8 = { x: (BigInt(payload.R8.x) + FIELD_SIZE).toString(), y: payload.R8.y };
  if (await verifyPoseidonSignature(serialize({ ...payload, R8: aliasedR8 }), publicKey, message)) {
    throw new Error("accepted a non-canonical R8.x (x + p)");
  }
  const aliasedKey = { x: (BigInt(publicKey.x) + FIELD_SIZE).toString(), y: publicKey.y };
  if (await verifyPoseidonSignature(serialize(payload), aliasedKey, message)) {
    throw new Error("accepted a non-canonical public key (x + p)");
  }
  if (await verifyPoseidonSignature(serialize({ ...payload, S: `0${payload.S}` }), publicKey, message)) {
    throw new Error("accepted a zero-padded S");
  }
  let threw = false;
  try {
    await verifyPoseidonSignature("{}", publicKey, message);
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error("malformed payload did not throw");
  }
});
