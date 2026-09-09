// Deno test: deno test --allow-env supabase/functions/_shared/nullification.test.ts
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  electionIdToField,
  isWellFormedProofPayload,
  NULLIFICATION_PUBLIC_SIGNAL_COUNT,
  parseNullificationSignals,
} from "./nullification.ts";

const FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function proof(overrides: Record<string, unknown> = {}) {
  return {
    pi_a: ["1", "2", "1"],
    pi_b: [["3", "4"], ["5", "6"], ["1", "0"]],
    pi_c: ["7", "8", "1"],
    protocol: "groth16",
    curve: "bn128",
    ...overrides,
  };
}

function signals(count = NULLIFICATION_PUBLIC_SIGNAL_COUNT): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

Deno.test("electionIdToField encodes the UUID as a 128-bit decimal and rejects non-UUIDs", () => {
  assertEquals(electionIdToField("00000000-0000-0000-0000-000000000001"), "1");
  assertEquals(
    electionIdToField("ffffffff-ffff-ffff-ffff-ffffffffffff"),
    ((1n << 128n) - 1n).toString()
  );
  assertEquals(
    electionIdToField("3F2504E0-4F89-11D3-9A0C-0305E82C3301"),
    electionIdToField("3f2504e0-4f89-11d3-9a0c-0305e82c3301")
  );
  assertThrows(() => electionIdToField("not-a-uuid"));
  assertThrows(() => electionIdToField("3f2504e04f8911d39a0c0305e82c3301ff"));
});

Deno.test("parseNullificationSignals maps the 17 signals and exposes the election binding", () => {
  const parsed = parseNullificationSignals(signals());
  assertEquals(parsed.ciphertext.c1, { x: "1", y: "2" });
  assertEquals(parsed.gateOutput.c2, { x: "7", y: "8" });
  assertEquals(parsed.accumulator.c1, { x: "9", y: "10" });
  assertEquals(parsed.voterPublicKey, { x: "13", y: "14" });
  assertEquals(parsed.authorityPublicKey, { x: "15", y: "16" });
  assertEquals(parsed.electionId, "17");
  assertThrows(() => parseNullificationSignals(signals(16)));
});

Deno.test("isWellFormedProofPayload accepts the expected shape only", () => {
  assertEquals(isWellFormedProofPayload({ proof: proof(), publicSignals: signals() }), true);

  assertEquals(isWellFormedProofPayload(null), false);
  assertEquals(isWellFormedProofPayload({ proof: proof(), publicSignals: signals(16) }), false);
  assertEquals(isWellFormedProofPayload({ proof: proof(), publicSignals: signals(18) }), false);
  assertEquals(isWellFormedProofPayload({ proof: proof({ protocol: "plonk" }), publicSignals: signals() }), false);
  assertEquals(isWellFormedProofPayload({ proof: proof({ curve: "bls12381" }), publicSignals: signals() }), false);
  assertEquals(isWellFormedProofPayload({ proof: proof({ pi_a: ["1", "2"] }), publicSignals: signals() }), false);
  assertEquals(isWellFormedProofPayload({ proof: proof({ pi_b: [["1", "2"], ["3"], ["1", "0"]] }), publicSignals: signals() }), false);

  const oversized = signals();
  oversized[0] = "9".repeat(FIELD_SIZE.toString().length + 1);
  assertEquals(isWellFormedProofPayload({ proof: proof(), publicSignals: oversized }), false);
  const hex = signals();
  hex[3] = "0x10";
  assertEquals(isWellFormedProofPayload({ proof: proof(), publicSignals: hex }), false);
  const padded = signals();
  padded[5] = "007";
  assertEquals(isWellFormedProofPayload({ proof: proof(), publicSignals: padded }), false);
  const signed = signals();
  signed[6] = "-1";
  assertEquals(isWellFormedProofPayload({ proof: proof(), publicSignals: signed }), false);
  assertEquals(isWellFormedProofPayload({ proof: proof({ pi_c: ["7", 8, "1"] }), publicSignals: signals() }), false);
});
