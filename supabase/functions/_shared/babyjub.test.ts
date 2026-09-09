import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  BABYJUB_FIELD,
  isCanonicalPrimeSubgroupPoint,
} from "./babyjub.ts";

const BASE_POINT = {
  x: "5299619240641551281634865583518297030282874472190772894086521144482721001553",
  y: "16950150798460657717958625567821834550301663161624707787222815936182638968203",
};

Deno.test("BabyJubJub validation accepts the canonical prime-subgroup base point", () => {
  assertEquals(isCanonicalPrimeSubgroupPoint(BASE_POINT, false), true);
});

Deno.test("BabyJubJub validation rejects identity when a ciphertext component forbids it", () => {
  assertEquals(isCanonicalPrimeSubgroupPoint({ x: "0", y: "1" }, false), false);
  assertEquals(isCanonicalPrimeSubgroupPoint({ x: "0", y: "1" }), true);
});

Deno.test("BabyJubJub validation rejects noncanonical and out-of-field coordinates", () => {
  assertEquals(isCanonicalPrimeSubgroupPoint({ x: "00", y: "1" }), false);
  assertEquals(
    isCanonicalPrimeSubgroupPoint({ x: BABYJUB_FIELD.toString(), y: "1" }),
    false
  );
});

Deno.test("BabyJubJub validation rejects off-curve and small-subgroup points", () => {
  assertEquals(isCanonicalPrimeSubgroupPoint({ x: "1", y: "1" }), false);
  assertEquals(
    isCanonicalPrimeSubgroupPoint({
      x: "0",
      y: (BABYJUB_FIELD - 1n).toString(),
    }),
    false
  );
});
