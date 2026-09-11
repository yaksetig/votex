import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as snarkjs from "snarkjs";
import {
  EdwardsPoint,
  elgamalEncrypt,
  computeXorGate,
  derivePublicKey,
} from "../services/elGamalService";
import { CURVE_ORDER } from "../services/crypto/constants";
import { electionIdToField } from "../services/crypto/utils";
import type { VerificationKey } from "../types/proof";

// Exercises the COMPILED circuit (not the TS model) by attempting witness
// generation against public/circuits/nullification_xor.wasm. A malformed
// witness must make witness calculation throw; a well-formed one must succeed.
// This is the only test that proves the circuit's constraints actually reject
// bad inputs, complementing the arithmetic-level tests in xorNullification.

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = resolve(here, "../../public/circuits/nullification_xor.wasm");
const zkeyPath = resolve(here, "../../public/circuits/nullification_xor_final.zkey");
const verificationKeyPath = resolve(here, "../../public/circuits/verification_key_xor.json");

let wasm: Uint8Array;
let verificationKey: VerificationKey;

beforeAll(async () => {
  wasm = new Uint8Array(await readFile(wasmPath));
  verificationKey = JSON.parse(await readFile(verificationKeyPath, "utf8")) as VerificationKey;
});

interface CircuitInput {
  ciphertext: string[];
  gate_output: string[];
  accumulator: string[];
  pk_voter: string[];
  pk_authority: string[];
  election_id: string;
  x: string;
  r: string;
  s: string;
  sk_voter: string;
}

const TEST_ELECTION_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

// Build a fully-consistent witness input for a real nullification (x=1).
function buildValidInput(): CircuitInput {
  // Voter keypair: sk_voter * G = pk_voter
  const skVoter = 987654321n % CURVE_ORDER;
  const pkVoter = derivePublicKey(skVoter);

  // Authority public key H = skAuthority * G
  const pkAuthority = derivePublicKey(13579n % CURVE_ORDER);

  const x = 1;
  const r = 24680n % CURVE_ORDER;
  const s = 11223n % CURVE_ORDER;

  // Identity accumulator (first nullification for this slot)
  const accumulator = {
    c1: EdwardsPoint.identity(),
    c2: EdwardsPoint.identity(),
    r: 0n,
    ciphertext: [0n, 1n, 0n, 1n] as [bigint, bigint, bigint, bigint],
  };

  const freshCiphertext = elgamalEncrypt(pkAuthority, x, r);
  const gateOutput = computeXorGate(x, accumulator, pkAuthority, s);

  return {
    ciphertext: [
      freshCiphertext.c1.x.toString(),
      freshCiphertext.c1.y.toString(),
      freshCiphertext.c2.x.toString(),
      freshCiphertext.c2.y.toString(),
    ],
    gate_output: [
      gateOutput.c1.x.toString(),
      gateOutput.c1.y.toString(),
      gateOutput.c2.x.toString(),
      gateOutput.c2.y.toString(),
    ],
    accumulator: ["0", "1", "0", "1"],
    pk_voter: [pkVoter.x.toString(), pkVoter.y.toString()],
    pk_authority: [pkAuthority.x.toString(), pkAuthority.y.toString()],
    election_id: electionIdToField(TEST_ELECTION_ID),
    x: x.toString(),
    r: r.toString(),
    s: s.toString(),
    sk_voter: skVoter.toString(),
  };
}

async function calculateWitness(input: CircuitInput): Promise<void> {
  // snarkjs writes the witness to a buffer; we only care whether the
  // constraints are satisfiable, so the output is discarded.
  await snarkjs.wtns.calculate(
    input as unknown as Record<string, unknown>,
    wasm,
    { type: "mem" }
  );
}

describe("compiled nullification_xor circuit", () => {
  it("accepts a well-formed real nullification (x=1, sk*G = pk_voter)", async () => {
    await expect(calculateWitness(buildValidInput())).resolves.toBeUndefined();
  });

  it("produces a proof accepted by the matching verification key", async () => {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      buildValidInput() as unknown as Record<string, string | string[]>,
      wasmPath,
      zkeyPath
    );
    await expect(
      snarkjs.groth16.verify(verificationKey, publicSignals, proof)
    ).resolves.toBe(true);

    // The election id is public signal 16; a proof presented for a different
    // election must not verify (cross-election replay regression).
    expect(publicSignals).toHaveLength(17);
    expect(publicSignals[16]).toBe(electionIdToField(TEST_ELECTION_ID));
    const replayed = [...publicSignals];
    replayed[16] = electionIdToField("00000000-0000-0000-0000-000000000001");
    await expect(
      snarkjs.groth16.verify(verificationKey, replayed, proof)
    ).resolves.toBe(false);
  }, 60_000);

  it("rejects an election id wider than 128 bits", async () => {
    const input = buildValidInput();
    input.election_id = (1n << 128n).toString();
    await expect(calculateWitness(input)).rejects.toThrow(/Assert Failed|Error in template/);
  });

  it("rejects a non-binary nullification bit (x=2)", async () => {
    const input = buildValidInput();
    input.x = "2";
    await expect(calculateWitness(input)).rejects.toThrow(/Assert Failed|Error in template/);
  });

  it("rejects a real nullification with the wrong voter secret key", async () => {
    const input = buildValidInput();
    // For x=1 the circuit forces sk_voter * G == pk_voter; a mismatched key
    // must fail the constraint system.
    input.sk_voter = ((BigInt(input.sk_voter) + 1n) % CURVE_ORDER).toString();
    await expect(calculateWitness(input)).rejects.toThrow(/Assert Failed|Error in template/);
  });

  it("rejects zero encryption randomness", async () => {
    const input = buildValidInput();
    const base = EdwardsPoint.base();
    input.r = "0";
    input.ciphertext = ["0", "1", base.x.toString(), base.y.toString()];
    await expect(calculateWitness(input)).rejects.toThrow(/Assert Failed|Error in template/);
  });

  it("rejects zero gate randomness", async () => {
    const input = buildValidInput();
    input.s = "0";
    input.gate_output = ["0", "1", "0", "1"];
    await expect(calculateWitness(input)).rejects.toThrow(/Assert Failed|Error in template/);
  });

  it("rejects subgroup-order aliases for encryption randomness", async () => {
    const input = buildValidInput();
    const base = EdwardsPoint.base();
    input.r = CURVE_ORDER.toString();
    input.ciphertext = ["0", "1", base.x.toString(), base.y.toString()];
    await expect(calculateWitness(input)).rejects.toThrow(/Assert Failed|Error in template/);
  });

  it("rejects subgroup-order aliases for gate randomness", async () => {
    const input = buildValidInput();
    input.s = CURVE_ORDER.toString();
    input.gate_output = ["0", "1", "0", "1"];
    await expect(calculateWitness(input)).rejects.toThrow(/Assert Failed|Error in template/);
  });
});
