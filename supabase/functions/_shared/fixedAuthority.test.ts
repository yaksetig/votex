import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isPlaceholderAuthorityKey,
  isUuid,
  PLACEHOLDER_AUTHORITY_PUBLIC_KEY,
} from "./fixedAuthority.ts";

Deno.test("fixed authority requires a real UUID", () => {
  assertEquals(isUuid("f78d4e1b-c82d-4ef7-93ef-0348eca57ee5"), true);
  assertEquals(isUuid("Default Election Authority"), false);
  assertEquals(isUuid("f78d4e1b-c82d-4ef7-93ef-0348eca57ee5x"), false);
});

Deno.test("the base-point authority key is recognised as the unconfigured placeholder", () => {
  assertEquals(isPlaceholderAuthorityKey(PLACEHOLDER_AUTHORITY_PUBLIC_KEY), true);
  assertEquals(isPlaceholderAuthorityKey({ x: "1", y: "2" }), false);
});
